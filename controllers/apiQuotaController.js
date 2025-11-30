// controllers/apiQuotaController.js
const admin = require("firebase-admin");
const db = require("../firebase/firebase");
const apiKeys = require("../apiKeys");

// =====================================
// RENDER MANAGEMENT PAGE
// =====================================
exports.renderManager = async (req, res) => {
  try {
    const apiKey = req.query.apiKey;
    if (!apiKey) return res.send("Missing API Key");

    const doc = await db.collection("users").doc(apiKey).get();
    if (!doc.exists) return res.send("API Key Not Found");

    const user = doc.data();

    // HTML PAGE
    res.send(`
      <html>
      <body style="font-family:Arial;margin:30px;">
        <h2>API Key Manager</h2>

        <p><b>Name:</b> ${user.name}</p>
        <p><b>Email:</b> ${user.email}</p>
        <p><b>API Key:</b> ${apiKey}</p>
        <p><b>Status:</b> ${user.disabled ? "❌ Disabled" : "✅ Active"}</p>
        <p><b>Total Quota:</b> ${user.quotaTotal}</p>
        <p><b>Remaining Tokens:</b> ${user.quotaRemaining}</p>
        <p><b>Total Fetches:</b> ${user.totalFetches}</p>

        <hr><h3>Modify Quota</h3>

        <form id="quotaForm" onsubmit="submitForm(event)">
          <input type="hidden" id="apiKey" value="${apiKey}" />

          <label><b>Action:</b></label><br>
          <select id="action" onchange="updateAmount()">
            <option value="add">Add Tokens</option>
            <option value="reset" data-total="${user.quotaTotal}">Reset Tokens</option>
          </select>
          <br><br>

          <label><b>Amount:</b></label><br>
          <input type="number" id="amount" placeholder="Enter number" />
          <br><br>

          <label><b>Status:</b></label><br>
<select id="disable">
  ${user.disabled
        ? `
        <!-- API KEY IS DISABLED -->
        <option value="true" selected>❌ Disabled (Current)</option>
        <option value="false">✅ Enable</option>
      `
        : `
        <!-- API KEY IS ENABLED -->
        <option value="false" selected>✅ Enabled (Current)</option>
        <option value="true">❌ Disable</option>
      `
      }
</select>
<br><br>

          <button type="submit" 
            style="padding:10px;background:green;color:white;border:none;">
            Apply Changes
          </button>
        </form>

        <script>
          async function submitForm(e) {
            e.preventDefault();

            const payload = {
              apiKey: document.getElementById("apiKey").value,
              action: document.getElementById("action").value,
              amount: Number(document.getElementById("amount").value),
              disable: document.getElementById("disable").value
            };

            const res = await fetch("/api/manage/update", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload)
            });

            if (!res.ok) {
              alert("Unable To Update API");
              return;
            }

            const data = await res.json();
            if (data.success) {
              window.location.href = "/api/apiKeys";
            }
          }


            function updateAmount() {
    const action = document.getElementById("action").value;
    const amountField = document.getElementById("amount");

    if (action === "add") {
      amountField.value = 0; // default
    } else if (action === "reset") {
      const total = document.querySelector('#action option[value="reset"]').dataset.total;
      amountField.value = Number(total); // fill current total
    }
  }

  // Run on page load to set initial state
  updateAmount();
        </script>

      </body>
      </html>
    `);

  } catch (err) {
    res.status(500).send(err.message);
  }
};


// =====================================
// UPDATE / MODIFY API KEY QUOTA
// =====================================
exports.updateManager = async (req, res) => {
  try {
    let { apiKey, action, amount, disable } = req.body;

    if (!apiKey) return res.send("Missing API Key");
    if (!action) return res.send("Missing Action");
    if (!amount || isNaN(amount)) amount = 0;

    amount = Number(amount);

    const docRef = db.collection("users").doc(apiKey);
    const doc = await docRef.get();
    if (!doc.exists) return res.send("API Key Not Found");

    const user = doc.data();

    // ==========================
    // ENABLE / DISABLE API KEY
    // ==========================
    await docRef.update({
      disabled: disable === "true"
    });

    apiKeys.update(
      { apiKey },
      {
        $set: {
          disabled: disable === "true"
        }
      },
      {}
    );
    // ==========================
    // ADD TOKENS
    // ==========================
    if (action === "add" && amount && amount > 0) {
      await docRef.update({
        quotaTotal: user.quotaTotal + amount,
        quotaRemaining: user.quotaRemaining + amount
      });

      apiKeys.update(
        { apiKey },
        {
          $inc: {
            quotaTotal: user.quotaTotal + amount,
            quotaRemaining: user.quotaRemaining + amount
          }
        },
        {}
      );
    }

    // ==========================
    // RESET TOKENS
    // ==========================
    if (action === "reset" && amount && amount > 0) {
      await docRef.update({
        quotaTotal: amount,
        totalFetches: 0,
        quotaRemaining: amount
      });

      apiKeys.update(
        { apiKey },
        {
          $set: {
        quotaTotal: amount,
        totalFetches: 0,
        quotaRemaining: amount
      }
        },
        {}
      );
    }

    apiKeys.persistence.compactDatafile();

    return res.json({ success: true });

  } catch (err) {
    res.status(500).send(err.message);
  }
};