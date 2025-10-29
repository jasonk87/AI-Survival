import asyncio
import time

async def main():
    print(f"[{time.time()}] Hello from asyncio!")
    await asyncio.sleep(1)
    print(f"[{time.time()}] Goodbye from asyncio!")

if __name__ == "__main__":
    print("Starting asyncio test...")
    asyncio.run(main())
    print("Asyncio test finished.")
