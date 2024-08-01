import sys
import json
import struct
import subprocess
import threading

def send_message_to_chrome(message):
    encoded_message = json.dumps(message).encode('utf-8')
    sys.stdout.buffer.write(struct.pack('I', len(encoded_message)))
    sys.stdout.buffer.write(encoded_message)
    sys.stdout.buffer.flush()

def read_message_from_chrome():
    raw_length = sys.stdin.buffer.read(4)
    if not raw_length:
        return None
    message_length = struct.unpack('I', raw_length)[0]
    message = sys.stdin.buffer.read(message_length).decode('utf-8')
    return json.loads(message)

def forward_messages_to_chrome(process):
    while True:
        output = process.stdout.readline()
        if output == '' and process.poll() is not None:
            break
        if output:
            try:
                message = json.loads(output.strip())
                if isinstance(message, dict) and "type" in message:
                    send_message_to_chrome(message)
            except json.JSONDecodeError:
                # Ignore non-JSON output (e.g., logging messages)
                pass

def main():
    # Launch ryzen_message_processor.py as a subprocess
    process = subprocess.Popen(
        ['python', 'ryzen_message_processor.py'],
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        bufsize=1
    )

    # Start a thread to forward messages from the subprocess to Chrome
    forward_thread = threading.Thread(target=forward_messages_to_chrome, args=(process,))
    forward_thread.start()

    # Main loop to read messages from Chrome and forward them to the subprocess
    while True:
        message = read_message_from_chrome()
        if message is None:
            break
        
        # Forward the message to ryzen_message_processor.py
        process.stdin.write(json.dumps(message) + '\n')
        process.stdin.flush()

    # Clean up
    process.terminate()
    forward_thread.join()

if __name__ == "__main__":
    main()