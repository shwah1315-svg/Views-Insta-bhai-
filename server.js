const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.static('.'));

app.get('/api/user/:username', async (req, res) => {
    try {
        const username = req.params.username;
        const url = 'https://imginn.com/' + username + '/';
        
        const response = await axios.get(url, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
        });
        
        const $ = cheerio.load(response.data);
        const displayName = $('.user-name').text().trim() || username;
        const bio = $('.user-bio').text().trim() || '';
        
        res.json({ success: true, username, displayName, bio });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Instagram Blocked Scraping' });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('Server running on port ' + PORT));
