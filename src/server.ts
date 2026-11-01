import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { Keypair } from '@solana/web3.js';
import { calculateFee, splitFee, OPERATOR_WALLET } from './split.js';
import { evaluateWarden, evaluateReferee } from './judge.js';
import { Attempt } from './types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3030;

app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// In-memory state for fast demo/devnet testing
let attemptCount = 48;
let potLamports = 175_000_000; // 1.75 SOL
const attempts = new Map<string, Attempt>();

app.get('/api/vault', (req, res) => {
  res.json({
    potSol: (potLamports / 1e9).toFixed(3),
    attemptCount,
    currentFeeSol: (calculateFee(attemptCount) / 1e9).toFixed(3),
    operatorWallet: OPERATOR_WALLET,
  });
});

app.post('/api/challenge', (req, res) => {
  const { prompt } = req.body;
  if (!prompt || typeof prompt !== 'string') {
    return res.status(400).json({ error: 'Prompt is required' });
  }

  const id = `att_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const feeLamports = calculateFee(attemptCount);
  const { treasury, pot } = splitFee(feeLamports, 30);
  const reference = Keypair.generate().publicKey.toBase58();

  const attempt: Attempt = {
    id,
    reference,
    prompt,
    feeLamports,
    treasuryLamports: treasury,
    potLamports: pot,
    status: 'pending_payment',
    createdAt: Date.now(),
  };

  attempts.set(id, attempt);

  res.json({
    attemptId: id,
    reference,
    feeLamports,
    feeSol: (feeLamports / 1e9).toFixed(3),
    treasurySol: (treasury / 1e9).toFixed(3),
    potSol: (pot / 1e9).toFixed(3),
    status: 'pending_payment',
  });
});

app.post('/api/verify', (req, res) => {
  const { attemptId, prompt } = req.body;
  const attempt = attempts.get(attemptId);
  const textToJudge = prompt || attempt?.prompt;

  if (!textToJudge) {
    return res.status(404).json({ error: 'Attempt not found or empty prompt' });
  }

  attemptCount++;
  const fee = attempt ? attempt.feeLamports : calculateFee(attemptCount);
  const { pot } = splitFee(fee, 30);
  potLamports += pot;

  // Run Dual-Lock Judge
  const wardenResult = evaluateWarden(textToJudge);
  const finalResult = evaluateReferee(wardenResult, textToJudge);

  if (attempt) {
    attempt.status = finalResult.verdict === 'won' ? 'won' : 'lost';
    attempt.reply = finalResult.reason;
  }

  res.json(finalResult);
});

app.listen(PORT, () => {
  console.log(`[AEGIS-VAULT] Live on http://localhost:${PORT}`);
});
