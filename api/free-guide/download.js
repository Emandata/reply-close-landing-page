const fs = require('fs');
const path = require('path');
const { GUIDE_FILE_NAME, verifyGuideToken } = require('../../lib/free-guide');

module.exports = async (req, res) => {
  if (req.method !== 'GET') return res.status(405).send('Method not allowed.');
  if (!verifyGuideToken(req.query && req.query.token)) return res.status(401).send('This Guide link is invalid or has expired.');

  try {
    const filePath = path.join(process.cwd(), 'private', 'sales-engine-guide-and-workbook.zip');
    if (!fs.existsSync(filePath)) return res.status(503).send('Your files are being prepared. Please try again shortly.');
    const file = fs.readFileSync(filePath);
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${GUIDE_FILE_NAME}"`);
    res.setHeader('Content-Length', file.length);
    return res.status(200).send(file);
  } catch (error) {
    return res.status(502).send('We could not prepare your download yet. Please try again.');
  }
};
