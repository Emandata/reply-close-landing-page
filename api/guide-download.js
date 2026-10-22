const fs = require('fs');
const path = require('path');
const { verifyPurchaseTransaction } = require('../lib/paystack');

module.exports = async (req, res) => {
  if (req.method !== 'GET') return res.status(405).send('Method not allowed.');

  try {
    const payment = await verifyPurchaseTransaction(req.query.reference);
    if (!payment.ok) return res.status(402).send('We could not confirm this purchase.');

    const filePath = path.join(process.cwd(), 'private', 'sales-engine-guide-and-workbook.zip');
    if (!fs.existsSync(filePath)) {
      return res.status(503).send('Your files are being prepared. Please try again shortly.');
    }

    const file = fs.readFileSync(filePath);
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', 'attachment; filename="The-24-7-Sales-Engine-Guide-and-Workbook.zip"');
    res.setHeader('Content-Length', file.length);
    return res.status(200).send(file);
  } catch (error) {
    return res.status(502).send('We could not prepare your download yet. Please try again.');
  }
};
