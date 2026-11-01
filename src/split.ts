import { PublicKey, SystemProgram, Transaction, TransactionInstruction } from '@solana/web3.js';
import { SplitResult } from './types.js';

export const OPERATOR_WALLET = "2nNtE6uEJQjX5vN1cS1m4FBRDuxxqq2hwmtFqn92xkNd";
export const MEMO_PROGRAM_ID = new PublicKey("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr");

export function calculateFee(attemptCount: number): number {
  const baseLamports = 10_000_000; // 0.01 SOL
  const maxLamports = 50_000_000;  // 0.05 SOL
  const scaled = Math.round(baseLamports * Math.pow(1.02, attemptCount));
  return Math.min(maxLamports, scaled);
}

export function splitFee(totalLamports: number, treasuryPercent = 30): SplitResult {
  const treasury = Math.floor((totalLamports * treasuryPercent) / 100);
  const pot = totalLamports - treasury;
  return { treasury, pot };
}

export function buildVaultTx(params: {
  payer: PublicKey;
  treasuryWallet: PublicKey;
  vaultWallet: PublicKey;
  reference: PublicKey;
  feeLamports: number;
  attemptId: string;
  recentBlockhash: string;
}): Transaction {
  const { treasury, pot } = splitFee(params.feeLamports, 30);
  const tx = new Transaction({
    recentBlockhash: params.recentBlockhash,
    feePayer: params.payer,
  });

  // 1. Transfer 30% directly to operator treasury (Zero-KYC extraction)
  const treasuryInstruction = SystemProgram.transfer({
    fromPubkey: params.payer,
    toPubkey: params.treasuryWallet,
    lamports: treasury,
  });
  // Append reference key to verify transaction receipt
  treasuryInstruction.keys.push({
    pubkey: params.reference,
    isSigner: false,
    isWritable: false,
  });
  tx.add(treasuryInstruction);

  // 2. Transfer 70% to the public prize vault
  tx.add(
    SystemProgram.transfer({
      fromPubkey: params.payer,
      toPubkey: params.vaultWallet,
      lamports: pot,
    })
  );

  // 3. Add memo binding the payment to this specific attempt ID
  tx.add(
    new TransactionInstruction({
      programId: MEMO_PROGRAM_ID,
      keys: [],
      data: Buffer.from(`aegis-vault:${params.attemptId}`, 'utf-8'),
    })
  );

  return tx;
}
