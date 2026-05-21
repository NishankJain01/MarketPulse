import axios from 'axios';

async function test() {
  console.log("Testing connection from Node to Python FastAPI...");
  try {
    const t0 = Date.now();
    const res = await axios.get('http://127.0.0.1:8000/', { timeout: 2000 });
    console.log(`✅ Success in ${Date.now() - t0}ms! Status:`, res.status);
    console.log("Data:", res.data);
  } catch (err) {
    console.error("❌ Connection failed:", err.message);
  }
}

test();
