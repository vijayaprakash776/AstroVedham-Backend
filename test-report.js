const https = require("https");

function post(url, data, headers = {}) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const body = JSON.stringify(data);
    const req = https.request({
      hostname: parsed.hostname,
      path: parsed.pathname,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(body),
        ...headers
      }
    }, (res) => {
      let buf = "";
      res.on("data", chunk => buf += chunk);
      res.on("end", () => resolve({ status: res.statusCode, headers: res.headers, body: JSON.parse(buf) }));
    });
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

function get(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const req = https.request({
      hostname: parsed.hostname,
      path: parsed.pathname,
      method: "GET",
      headers
    }, (res) => {
      const chunks = [];
      res.on("data", chunk => chunks.push(chunk));
      res.on("end", () => resolve({
        status: res.statusCode,
        headers: res.headers,
        buffer: Buffer.concat(chunks)
      }));
    });
    req.on("error", reject);
    req.end();
  });
}

async function run() {
  const host = "https://astrovedham-backend-postgresql.up.railway.app";
  console.log("Sending OTP...");
  await post(host + "/api/v1/auth/send-otp", { phone: "8807585172" });
  console.log("Verifying OTP...");
  const vRes = await post(host + "/api/v1/auth/verify-otp", { phone: "8807585172", otp: "123456" });
  const token = vRes.body.data.token;
  console.log("Customer token acquired.");

  console.log("Getting report for order AV-20260922-482102...");
  const reportRes = await get(host + "/api/v1/orders/AV-20260922-482102/report", {
    "Authorization": "Bearer " + token
  });

  console.log("HTTP Status:", reportRes.status);
  console.log("Content-Type:", reportRes.headers["content-type"]);
  console.log("Content-Disposition:", reportRes.headers["content-disposition"]);
  console.log("Buffer Length:", reportRes.buffer.length);
  console.log("First 10 Bytes:", reportRes.buffer.subarray(0, 10).toString());
}

run().catch(console.error);
