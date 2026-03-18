exports.handler = async (event) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json"
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers, body: "" };
  }

  const APP_ID = process.env.EBAY_APP_ID;
  const CERT_ID = process.env.EBAY_CERT_ID;

  if (!APP_ID || !CERT_ID) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: "Missing eBay credentials" }) };
  }

  try {
    const { type, keywords, perPage } = JSON.parse(event.body || "{}");

    // Get OAuth token
    const creds = Buffer.from(`${APP_ID}:${CERT_ID}`).toString("base64");
    const tokenRes = await fetch("https://api.ebay.com/identity/v1/oauth2/token", {
      method: "POST",
      headers: {
        "Authorization": `Basic ${creds}`,
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: "grant_type=client_credentials&scope=https%3A%2F%2Fapi.ebay.com%2Foauth%2Fapi_scope"
    });

    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) {
      return { statusCode: 401, headers, body: JSON.stringify({ error: "Token failed", detail: tokenData }) };
    }

    const token = tokenData.access_token;

    // Search listings
    if (type === "search") {
      const q = encodeURIComponent(keywords);
      const url = `https://api.ebay.com/buy/browse/v1/item_summary/search?q=${q}&category_ids=2536&limit=${perPage||100}&filter=buyingOptions%3A%7BFIXED_PRICE%7CBEST_OFFER%7D`;
      const res = await fetch(url, {
        headers: { "Authorization": `Bearer ${token}`, "X-EBAY-C-MARKETPLACE-ID": "EBAY_US" }
      });
      const data = await res.json();
      return { statusCode: 200, headers, body: JSON.stringify(data) };
    }

    // Sold listings for market rate
    if (type === "sold") {
      const q = encodeURIComponent(keywords);
      const url = `https://api.ebay.com/buy/browse/v1/item_summary/search?q=${q}&category_ids=2536&limit=10&filter=buyingOptions%3A%7BFIXED_PRICE%7D,conditionIds%3A%7B1000%7D`;
      const res = await fetch(url, {
        headers: { "Authorization": `Bearer ${token}`, "X-EBAY-C-MARKETPLACE-ID": "EBAY_US" }
      });
      const data = await res.json();
      return { statusCode: 200, headers, body: JSON.stringify(data) };
    }

    return { statusCode: 400, headers, body: JSON.stringify({ error: "Unknown type" }) };

  } catch (e) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: e.message }) };
  }
};
