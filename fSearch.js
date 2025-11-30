const fs = require('fs');
const axios = require('axios');
async function searchData(query) {
    try {
        const url = "https://www.films365.org/";
        const payload = [`${query}`];

        const response = await axios.post(url, JSON.stringify(payload), {
            headers: {
                "accept": "text/x-component",
                "accept-encoding": "gzip, deflate, br, zstd",
                "accept-language": "en-GB,en;q=0.9,sw;q=0.8",
                "content-type": "text/plain;charset=UTF-8",
                "cookie": "__client_uat=0; __client_uat__ShoTZIZ=0; __cf_bm=41QI4NixlPDprUDCvXHmFxNpW5MaElBnrTrmjbbDde8-1760019215-1.0.1.1-VCrQjlLt0HvK8g0shpWD1qBNZ0wxqMZhzPoHKhc1LBC_TH2SRGW2aP4yx4VGAOcV0V6Nfo31wTLICsyI7PNpnCWFV7SFgl3Bzgoc68bBFYM",
                "dnt": "1",
                "next-action": "70a399b14c1bdfccdb95300c1f15cb4188e4b0b4ca",
                "next-router-state-tree": "%5B%22%22%2C%7B%22children%22%3A%5B%22(home)%22%2C%7B%22children%22%3A%5B%22__PAGE__%22%2C%7B%7D%2C%22%2F%22%2C%22refresh%22%5D%7D%5D%7D%2Cnull%2Cnull%2Ctrue%5D",
                "origin": "https://www.films365.org",
                "priority": "u=1, i",
                "referer": "https://www.films365.org/",
                "sec-ch-ua": `"Not;A=Brand";v="99", "Google Chrome";v="139", "Chromium";v="139"`,
                "sec-ch-ua-mobile": "?1",
                "sec-ch-ua-platform": `"Android"`,
                "sec-fetch-dest": "empty",
                "sec-fetch-mode": "cors",
                "sec-fetch-site": "same-origin",
                "user-agent": "Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Mobile Safari/537.36"
            },

        });

        const text = response.data.toString();
        const chunks = text.split(/\n/).filter(Boolean);

        for (const chunk of chunks) {
            const sep = chunk.indexOf(":");
            if (sep !== -1) {
                const jsonStr = chunk.slice(sep + 1);
                try {
                    const parsed = JSON.parse(jsonStr);

                    if (parsed.results) {
                        return parsed;
                    }
                } catch {
                    // skip invalid JSON chunk
                    
                }
            }
        }
    } catch (err) {
        console.error(`❌ Error fetching page ${page}: ${err.message}`);
        return null;
    }
    return null;
}

module.exports = searchData;

// async function scrapeAll() {
//     const data = await searchData('n The Conjuring: Last Rites (2025) h');
//     console.log(data);
// }

// scrapeAll();
