const Anthropic = require('@anthropic-ai/sdk');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const apiKey = process.env.CLAUDE_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'Clé API Claude non configurée.' });

  const { positions, totalValue, totalInvested, totalGain, totalGainPct, settings } = req.body || {};

  const posLines = (positions || []).map(p => {
    const alloc = p.allocation?.toFixed(1) ?? '?';
    const gain = p.gain?.toFixed(2) ?? '?';
    const gainPct = p.gainPct?.toFixed(2) ?? '?';
    return `  - ${p.name} (${p.isin || 'N/A'}) : ${p.shares} parts × ${p.currentPrice?.toFixed(2) ?? '?'}€ = ${p.value?.toFixed(2) ?? '?'}€ | Gain: ${gain}€ (${gainPct}%) | Alloc actuelle: ${alloc}% / cible: ${p.target}%`;
  }).join('\n') || '  Aucune position';

  const feeRate = settings?.feeRate ?? 0.5;
  const feeMin = settings?.feeMin ?? 5;
  const budget = settings?.monthlyBudget ?? 300;
  const fee = Math.max(budget * feeRate / 100, feeMin);
  const effectiveFee = (fee / budget * 100).toFixed(2);

  const prompt = `Tu es un conseiller en gestion de patrimoine spécialisé PEA (Plan d'Épargne en Actions) pour des particuliers français.

**PROFIL DU PEA :**
- Ouverture : ${settings?.peaOpenDate || '03/03/2021'} → ✅ +5 ans atteints → Fiscalité : 17,2% prélèvements sociaux uniquement sur les plus-values
- Plafond PEA : 150 000 € (versements)
- Courtier : LCL — Commission : ${feeRate}% par ordre, minimum ${feeMin}€

**PORTEFEUILLE ACTUEL :**
${posLines}

**SYNTHÈSE :**
- Valeur totale : ${totalValue?.toFixed(2) ?? '0'}€
- Total investi : ${totalInvested?.toFixed(2) ?? '0'}€
- Plus-value brute : ${totalGain?.toFixed(2) ?? '0'}€ (${totalGainPct?.toFixed(2) ?? '0'}%)
- Impôt estimé (17,2% PS) : ${(Math.max(totalGain ?? 0, 0) * 0.172).toFixed(2)}€
- Plus-value nette : ${(totalGain ?? 0 - Math.max(totalGain ?? 0, 0) * 0.172).toFixed(2)}€

**STRATÉGIE DCA :**
- Budget mensuel : ${budget}€
- Frais LCL sur ce budget : ${fee.toFixed(2)}€ (${effectiveFee}% effectifs)

Fournis une analyse structurée avec ces 4 sections :

📊 **Bilan du portefeuille**
[2-3 phrases sur la performance globale et la qualité des positions]

⚖️ **Allocation & rééquilibrage**
[2-3 phrases sur l'adéquation entre allocation actuelle et cibles, et les ajustements à envisager]

💡 **Recommandation DCA**
[1-2 phrases concrètes : quelle position prioriser ce mois, et comment optimiser les frais LCL]

🎯 **Conseil patrimonial**
[2-3 phrases sur la stratégie PEA à long terme, la fiscalité et les optimisations possibles]

Réponds en français uniquement. Maximum 400 mots. Sois factuel, pédagogue et actionnable.`;

  try {
    const client = new Anthropic({ apiKey });
    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    });
    res.status(200).json({ advice: message.content[0].text });
  } catch (err) {
    res.status(500).json({ error: 'Erreur API Claude : ' + err.message });
  }
};
