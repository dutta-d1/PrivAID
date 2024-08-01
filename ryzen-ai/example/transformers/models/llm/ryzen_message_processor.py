import sys
import json
import struct
import threading
import time
import logging
import argparse
import os
import llm_eval
import torch

from llm_eval import (
    Phi3ModelEval
)
from ryzenai_llm_engine import RyzenAILLMEngine, TransformConfig

from transformers import (
    AutoTokenizer,
    set_seed,
    TextIteratorStreamer
)

#Global defines
model = None
stop_event = threading.Event()

# Setup Ryzen AI subsystem
def prepare_ryzen_ai():
    global model
    set_seed(123)

    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--target",
        help="cpu, aie, npugpu",
        type=str,
        default="aie",
        choices=["cpu", "aie", "npugpu"],
    )
    args = parser.parse_args()
    print(f"{args}")

    dev = os.getenv("DEVICE")

    CausalLMModel = Phi3ModelEval
    LMTokenizer = AutoTokenizer
    trust_remote_code = True

    qmodels_dir = "./quantized_models/"
    if not os.path.exists(qmodels_dir):
        os.makedirs(qmodels_dir)
    ckpt = qmodels_dir + "/quantized_Phi-3-mini-4k-instruct_w4_g128_pergrp.pth"

    ############################################################################################
    ### Step 1 - Load quantized model
    ### Step 2 - Model Transformation & Optimization
    ### Step 3 - Inference
    ############################################################################################

    if not os.path.exists(ckpt):
        print(f"\n\nQuantized Model not available ... {ckpt} !!! \n")
        print(
            f"\n\nRun with --task quantize and generate quantized model first \n"
        )
        raise SystemExit
    model = torch.load(ckpt)
    print(model)
    print(f"model.model_name: {model.model_name}")

    ##############################################################
    ### Step 2 - Model Transformation & Optimization
    transform_config = TransformConfig(
        flash_attention_plus=False,
        fast_mlp=False,
        fast_attention=False,
        precision='w4abf16',
        model_name='microsoft/Phi-3-mini-4k-instruct',
        target=args.target,
        w_bit=4,
        group_size=128,
        profilegemm=False,
        profile_layer=False,
        mhaops='all',
    )

    model = RyzenAILLMEngine.transform(model, transform_config)
    model = model.to(torch.bfloat16)
    model.eval()
    print(model)
    print(f"model.mode_name: {model.model_name}")
    model.tokenizer = LMTokenizer.from_pretrained(
                   'microsoft/Phi-3-mini-4k-instruct', trust_remote_code=trust_remote_code
                )
    send_info("Ryzen AI Ready")

def generate(input_text):
        global model
        global stop_event
        stop_event.clear()
        streamer = TextIteratorStreamer(model.tokenizer)
        
        thread = threading.Thread(target=llm_eval.gradio, kwargs=dict(
            model=model,
            tokenizer=model.tokenizer,
            prompt=input_text,
            streamer=streamer,
            max_new_tokens=500,
            assistant_model=None,
            apply_chat_tmpl=True,
        ))
        thread.start()

        buffer = ""
        for new_text in streamer:
            if stop_event.is_set():
                break
            buffer += new_text
            yield buffer

# Set up logging
logging.basicConfig(filename='ryzen_message_processor.log', level=logging.INFO, 
                    format='%(asctime)s - %(levelname)s - %(message)s')

def send_message(message):
    logging.debug(f"Sending message: {message}")
    encoded_message = json.dumps(message).encode('utf-8')
    sys.stdout.buffer.write(struct.pack('I', len(encoded_message)))
    sys.stdout.buffer.write(encoded_message)
    sys.stdout.buffer.flush()

def send_info(info_message):
    send_message({"type": "info", "text": info_message})

def send_error(error_message):
    send_message({"type": "error", "text": error_message})

def send_response(response_message, is_last):
    send_message({"type": "response", "text": response_message, "isLast": is_last})

def read_message():
    raw_length = sys.stdin.buffer.read(4)
    if not raw_length:
        return None
    message_length = struct.unpack('I', raw_length)[0]
    message = sys.stdin.buffer.read(message_length).decode('utf-8')
    logging.debug(f"Received raw message: {message}")

    try:
        return json.loads(message)  # Parse JSON string into a Python dictionary
    except json.JSONDecodeError as e:
        logging.error(f"JSON decode error: {str(e)}")
        return {"type": "error", "text": "Error in parsing the input"}  # Return an error message

def generate_llm_output(user_query):
    previous_words = []
    start_sending = False
    for partial_response in generate(user_query):
        current_words = partial_response.split()
        new_words = current_words[len(previous_words):]
        
        for i, word in enumerate(new_words):
            if start_sending:
                if "<|end|>" in word:
                    word = word.split("<|end|>")[0]
                    send_response(word, True)
                else:
                    send_response(word, False)
            if "<|end|><|assistant|>" in word:
                start_sending = True
            time.sleep(0.1)  # Small delay to control streaming speed
        
        previous_words = current_words

def process_message(message):
    message_type = message.get("type")
    if message_type == "query":
        text = message.get("text")
        context = message.get("context")
        if text and context:
            try:
                llm_user_query = text + "Use context while answering - " + context
                generate_llm_output(llm_user_query)
            except Exception as e:
                logging.error(f"Error in process_message: {str(e)}")
                send_error(f"Error: {str(e)}")
        else:
            send_error("Error in parsing the input")
    elif message_type == "summarize":
        context = message.get("context")
        if context:
            try:
                llm_user_query = "Rewrite the following website extract in human comprehensible concise form - " + context
                generate_llm_output(llm_user_query)
            except Exception as e:
                logging.error(f"Error in process_message: {str(e)}")
                send_error(f"Error: {str(e)}")
        else:
            send_error("Error in parsing the input")
    elif message_type == "compose":
        text = message.get("text")
        if text:
            try:
                generate_llm_output(text)
            except Exception as e:
                logging.error(f"Error in process_message: {str(e)}")
                send_error(f"Error: {str(e)}")
        else:
            send_error("Error in parsing the compose input")
    else:
        send_error("Error in parsing the message type")

def message_handler():
    while True:
        try:
            message = read_message()
            if message is None:
                logging.info("Received None message, breaking loop")
                break
            if message.get("type") == "error":
                send_message(message)
            else:
                logging.debug(f"Processed message: {message}")
                threading.Thread(target=process_message, args=(message,)).start()
        except Exception as e:
            logging.error(f"Error in message_handler: {str(e)}")
            send_error(f"Error: {str(e)}")

if __name__ == "__main__":
    logging.info("Initializing Ryzen AI")
    prepare_ryzen_ai()
    logging.info("Starting message handler")
    message_handler()
    logging.info("Ryzen AI Exiting")
    send_info("Ryzen AI Exiting")