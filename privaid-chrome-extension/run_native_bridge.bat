@echo off
call C:\Users\dipan\anaconda3\Scripts\activate.bat ryzenai-transformers
call C:\Users\dipan\Developer\RyzenAI-SW\example\transformers\setup_phx.bat
cd C:\Users\dipan\Developer\RyzenAI-SW\example\transformers\models\llm
python chrome_native_bridge.py