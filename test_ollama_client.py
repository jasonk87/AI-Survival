import asyncio
import ollama
import argparse

async def main(host: str):
    print(f"Attempting to create Ollama client for host: {host}")
    try:
        client = ollama.AsyncClient(host=host)
        print("Ollama client created successfully.")

        print("Attempting to generate a response...")
        response = await client.generate(
            model='llama2',
            prompt='Why is the sky blue? Be concise.'
        )
        print("Successfully received a response from Ollama:")
        print(response['response'])

    except Exception as e:
        print(f"An error occurred: {e}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--host", default="192.168.86.250", help="Ollama host")
    parser.add_argument("--port", default="11434", help="Ollama port")
    args = parser.parse_args()

    ollama_host = f"http://{args.host}:{args.port}"
    print(f"Starting Ollama client test for host: {ollama_host}")

    asyncio.run(main(host=ollama_host))
    print("Ollama client test finished.")
