// controllers/register.js
const { v4: uuidv4 } = require('uuid');
const admin = require('firebase-admin');
const db = require('../firebase/firebase');
const apiKeys = require("../apiKeys");

exports.register = async (req, res) => {
  try {
    const { email, name } = req.body;
    let quota = parseInt(req.body.quota ?? 100);

    if (!email || !name)
      return res.status(400).json({ error: "name & email required" });

    const apiKey = uuidv4();

    // FIREBASE SAVE
    await db.collection('users').doc(apiKey).set({
      apiKey,
      email,
      name,
      quotaTotal: quota,
      quotaRemaining: quota,
      totalFetches: 0,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    // NEDB SAVE
    await apiKeys.insert({
      apiKey,
      quotaRemaining: quota,
      totalFetches: 0,
      createdAt: new Date()
    });

    res.json({
      message: "registered",
      apiKey,
      quotaRemaining: quota
    });

  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

exports.registerForm = (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <title>Register API Key</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          background: #f5f6fa;
          display: flex;
          justify-content: center;
          margin-top: 60px;
        }
        .card {
          background: white;
          width: 430px;
          border-radius: 14px;
          padding: 30px;
          box-shadow: 0 5px 18px rgba(0,0,0,0.1);
        }
        h2 {
          margin-top: 0;
          text-align: center;
          font-weight: 600;
        }
        label {
          font-weight: bold;
          display: block;
          margin-bottom: 6px;
        }
        input {
          width: 100%;
          padding: 10px;
          border-radius: 8px;
          border: 1px solid #ddd;
          margin-bottom: 16px;
          font-size: 15px;
        }
        button {
          width: 100%;
          padding: 12px;
          background: #0066ff;
          border: none;
          border-radius: 8px;
          color: white;
          font-size: 16px;
          cursor: pointer;
        }
        button:hover {
          background: #0052d6;
        }
        .msg {
          margin-top: 18px;
          padding: 12px;
          border-radius: 8px;
          display: none;
          font-size: 14px;
        }
        .success {
          background: #e6ffed;
          color: #0d8f29;
          border: 1px solid #19b33d;
        }
        .error {
          background: #ffecec;
          color: #c92f2f;
          border: 1px solid #e04444;
        }
      </style>
    </head>

    <body>
      <div class="card">

        <h2>Create API Key</h2>
        <p style="color:#777; text-align:center; margin-top:-10px; margin-bottom:25px;">
          Fill the form to generate a new API Key.
        </p>

        <form onsubmit="submitForm(event)">
          
          <label>Name</label>
          <input type="text" id="name" placeholder="Enter full name" required />

          <label>Email</label>
          <input type="email" id="email" placeholder="Enter email address" required />

          <label>Quota (Tokens)</label>
          <input type="number" id="quota" value="100" min="1" required />

          <button type="submit">Register</button>
        </form>

        <div id="msg" class="msg"></div>
      </div>

      <script>
        async function submitForm(e) {
          e.preventDefault();

          const payload = {
            name: document.getElementById("name").value.trim(),
            email: document.getElementById("email").value.trim(),
            quota: Number(document.getElementById("quota").value)
          };

          const msgBox = document.getElementById("msg");

          try {
            const res = await fetch("/api/v1/user/register", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload)
            });

            const data = await res.json();

            if (!res.ok) {
              msgBox.className = "msg error";
              msgBox.innerHTML = data.error || "Server error.";
              msgBox.style.display = "block";
              return;
            }

            msgBox.className = "msg success";
            msgBox.innerHTML = 
              "<b>Registration successful!</b><br>API Key:<br><code>" + 
              data.apiKey + "</code>";
            msgBox.style.display = "block";

          } catch (err) {
            msgBox.className = "msg error";
            msgBox.innerHTML = "Network error: " + err.message;
            msgBox.style.display = "block";
          }
        }
      </script>

    </body>
    </html>
  `);
};
