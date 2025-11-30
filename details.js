const axios = require('axios');
const cheerio = require('cheerio');

exports.getDetails = async (url) => {
    try {

        const { data: html } = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
            }
        });

        const $ = cheerio.load(html);
        let foundData = null;
        $('script').each((i, el) => {
            const src = $(el).attr('src');
            if (src) {
            } else {
                if ($(el).html().includes('self.__next_f.push([1,"5:')) {
                    const text = $(el).html();

                    //console.log(cleaned); // ✅ add parentheses here

                    // Find the starting index of "initialDetails":
                    const startIndex = text.indexOf('initialDetails');

                    if (startIndex === -1) {
                        console.log("initialDetails not found");
                        //process.exit();
                    }

                    // Slice text from that position
                    const afterStart = text.slice(startIndex + 'initialDetails'.length);

                    // Find all closing curly braces in that slice
                    const closingBraces = [...afterStart.matchAll(/}/g)].map(m => m.index);

                    // Make sure there are at least 2 closing braces
                    if (closingBraces.length < 2) {
                        console.log("Not enough closing braces");
                        //process.exit();
                    }


                    // Get everything before the *second last* closing brace
                    const secondLastIndex = closingBraces[closingBraces.length - 3];
                    const extracted = afterStart.slice(0, secondLastIndex + 1).trim();

                    const result = extracted.split(':').slice(1).join(':');
                    let rawString = result.trim();
                    rawString = rawString.replace(/\\"/g, '"');

                    rawString = rawString.replace(/\\"/g, '"');
                     let converted = JSON.parse(rawString);

                    foundData = converted;

                }

            }
        });
        if(foundData){
            console.log('success')
        }

        return foundData;

    } catch (err) {
        console.error('Error fetching details:', err.message);
        return null;
    }
};
