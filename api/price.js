module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');

  const ticker = req.query.ticker;
  if (!ticker) return res.status(400).json({ error: 'Paramètre ticker requis' });

  const url = `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?range=1y&interval=1wk`;

  try {
    const r = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept': 'application/json',
      },
    });

    if (!r.ok) throw new Error(`Yahoo Finance HTTP ${r.status}`);

    const data = await r.json();
    const result = data.chart?.result?.[0];
    if (!result) throw new Error('Aucune donnée');

    const meta = result.meta;
    const price = meta.regularMarketPrice;
    const prevClose = meta.chartPreviousClose || meta.previousClose;
    const change = prevClose ? +(price - prevClose).toFixed(2) : 0;
    const changePct = prevClose ? +(((price - prevClose) / prevClose) * 100).toFixed(2) : 0;

    const timestamps = result.timestamp || [];
    const closes = result.indicators?.quote?.[0]?.close || [];
    const history = timestamps
      .map((ts, i) => ({
        date: new Date(ts * 1000).toISOString().split('T')[0],
        close: closes[i] != null ? +closes[i].toFixed(4) : null,
      }))
      .filter(d => d.close !== null);

    res.status(200).json({ price, prevClose, change, changePercent: changePct, currency: meta.currency, history });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
