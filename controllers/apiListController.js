// controllers/apiListController.js
const db = require("../firebase/firebase");
const apiKeys = require("../apiKeys");
const admin = require("firebase-admin");

exports.viewAll = async (req, res) => {
  try {
    const usersSnapshot = await db.collection("users").get();
    const firebaseUsers = [];
    usersSnapshot.forEach((doc) => firebaseUsers.push(doc.data()));

    (async () => {
      try {
        // Find all documents using the async method
     //   const nedbKeys = await apiKeys.findAsync({});
        // docs is an array containing all documents

        const merged = firebaseUsers.map(user => {
     //     const local = nedbKeys.find(k => k.apiKey === user.apiKey);
          return {
            apiKey: user.apiKey,
            name: user.name,
            email: user.email,
            quotaTotal: user.quotaTotal,
            disabled: user.disabled ?? false,
            createdAt: user.createdAt ? user.createdAt.toDate().toLocaleString() : "unknown",
            quotaRemaining: user?.quotaRemaining ?? 0,
            totalFetches: user?.totalFetches ?? 0
          };
        });

        // Render HTML
        let rows = merged.map(u => `
        <tr>
          <td>${u.name}</td>
          <td>${u.email}</td>
          <td>${u.apiKey}</td>
          <td>${u.quotaTotal}</td>
          <td>${u.quotaRemaining}</td>
          <td>${u.totalFetches}</td>
          <td>${u.disabled ? "❌ Disabled" : "✅ Active"}</td>
          <td>${u.createdAt}</td>
          <td>
            <a href="/api/manage?apiKey=${u.apiKey}">Manage</a>
          </td>
        </tr>
      `).join("");

        res.send(`
        <html>
        <head>
          <title>All API Keys</title>
          <style>
            body { font-family: Arial; margin: 30px; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #ccc; padding: 8px; text-align: left; }
            th { background: #f5f5f5; }
            tr:nth-child(even) { background: #fafafa; }
          </style>
        </head>
        <body>
          <h2>All API Keys</h2>
          <p>Total Users: ${merged.length}</p>

          <table>
            <thead>
              <tr>
                <th>Owner Name</th>
                <th>Email</th>
                <th>API Key</th>
                <th>Total Quota</th>
                <th>Remaining Tokens</th>
                <th>Total Fetches</th>
                <th>Status</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </body>
        </html>
      `);

      } catch (err) {
        console.error(err);
      }
    })();

  } catch (err) {
    res.status(500).send("Internal Error: " + err.message);
  }
};
