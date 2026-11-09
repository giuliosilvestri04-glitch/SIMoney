/**
 * ============================================================================
 * SEED — DATI DIMOSTRATIVI DEL PROTOTIPO
 * ============================================================================
 *
 * Genera un ambiente demo completo e COERENTE:
 *   consulenti · clienti · portafogli · posizioni · storico giornaliero ·
 *   movimenti · proposte in tutti gli stati · documenti PDF fittizi.
 *
 * Caratteristiche importanti:
 *  • DETERMINISTICO — stesso seme (SEED_RANDOM_SEED) ⇒ stesse cifre a ogni
 *    reinstallazione. La demo mostrata all'azienda non cambia mai.
 *  • DATI FITTIZI — nomi generici, email @demo.local, ISIN inventati,
 *    codici fiscali e IBAN mascherati. Nessun dato personale reale.
 *  • AUTOSUFFICIENTE — non richiede Guardian né alcun sistema esterno.
 */

import bcrypt from 'bcryptjs';
import { prisma } from '../src/lib/prisma.js';
import { env } from '../src/config/env.js';
import { Rng } from '../src/lib/rng.js';
import { money, normalizeWeights, pct } from '../src/lib/money.js';
import { addDays, isWeekend, startOfUTCDay, toISODate } from '../src/lib/dates.js';
import { generateProposalDocument, storeGeneratedDocument } from '../src/services/document.service.js';
import { formatEur } from '../src/lib/pdf.js';

const rng = new Rng(env.seed.randomSeed);

// ---------------------------------------------------------------------------
// Anagrafiche fittizie
// ---------------------------------------------------------------------------

const ASSET_CLASSES = [
  { key: 'azionario', label: 'Azionario', colorHex: '#2563EB', orderIndex: 1, riskLevel: 4, drift: 0.082, vol: 0.16, description: 'Azioni e fondi azionari globali' },
  { key: 'obbligazionario', label: 'Obbligazionario', colorHex: '#0EA5E9', orderIndex: 2, riskLevel: 2, drift: 0.028, vol: 0.048, description: 'Titoli di Stato e obbligazioni corporate' },
  { key: 'fondi', label: 'Fondi e ETF', colorHex: '#7C3AED', orderIndex: 3, riskLevel: 3, drift: 0.058, vol: 0.105, description: 'Fondi comuni ed ETF multi-asset' },
  { key: 'liquidita', label: 'Liquidità', colorHex: '#64748B', orderIndex: 4, riskLevel: 1, drift: 0.004, vol: 0.002, description: 'Disponibilità sul conto corrente' },
  { key: 'alternativi', label: 'Alternativi', colorHex: '#F59E0B', orderIndex: 5, riskLevel: 5, drift: 0.092, vol: 0.205, description: 'Private markets, materie prime, strategie alternative' },
  { key: 'monetario', label: 'Monetario', colorHex: '#14B8A6', orderIndex: 6, riskLevel: 1, drift: 0.031, vol: 0.009, description: 'Strumenti monetari a breve termine' },
] as const;

type AssetClassKey = (typeof ASSET_CLASSES)[number]['key'];

const TARGET_ALLOCATION: Record<string, Partial<Record<AssetClassKey, number>>> = {
  PRUDENTE: { azionario: 12, obbligazionario: 45, fondi: 18, liquidita: 15, monetario: 10 },
  BILANCIATO: { azionario: 32, obbligazionario: 30, fondi: 22, liquidita: 9, monetario: 4, alternativi: 3 },
  DINAMICO: { azionario: 45, obbligazionario: 20, fondi: 22, liquidita: 6, alternativi: 5, monetario: 2 },
  AGGRESSIVO: { azionario: 58, obbligazionario: 10, fondi: 18, liquidita: 4, alternativi: 10 },
};

const INSTRUMENTS = [
  { isin: 'IT0DEMO00101', name: 'Azionario Europa Core', type: 'FUND', issuer: 'Demo Asset Management', assetClass: 'azionario', price: 148.32 },
  { isin: 'IT0DEMO00102', name: 'Azionario Globale Sostenibile', type: 'FUND', issuer: 'Demo Asset Management', assetClass: 'azionario', price: 96.74 },
  { isin: 'IT0DEMO00103', name: 'ETF MSCI World (demo)', type: 'ETF', issuer: 'Demo Index Solutions', assetClass: 'azionario', price: 78.91 },
  { isin: 'IT0DEMO00104', name: 'Azionario Italia Large Cap', type: 'FUND', issuer: 'Demo SGR', assetClass: 'azionario', price: 34.28 },
  { isin: 'IT0DEMO00105', name: 'Azionario Tecnologia', type: 'ETF', issuer: 'Demo Index Solutions', assetClass: 'azionario', price: 211.55 },
  { isin: 'IT0DEMO00201', name: 'BTP Demo 2031 3,25%', type: 'BOND', issuer: 'Tesoro Simulato', assetClass: 'obbligazionario', price: 101.4 },
  { isin: 'IT0DEMO00202', name: 'Obbligazionario Euro Governativo', type: 'FUND', issuer: 'Demo SGR', assetClass: 'obbligazionario', price: 52.17 },
  { isin: 'IT0DEMO00203', name: 'Corporate Bond Investment Grade', type: 'FUND', issuer: 'Demo Asset Management', assetClass: 'obbligazionario', price: 44.63 },
  { isin: 'IT0DEMO00204', name: 'ETF Obbligazionario Globale', type: 'ETF', issuer: 'Demo Index Solutions', assetClass: 'obbligazionario', price: 88.05 },
  { isin: 'IT0DEMO00205', name: 'BTP Demo 2028 2,10%', type: 'BOND', issuer: 'Tesoro Simulato', assetClass: 'obbligazionario', price: 98.72 },
  { isin: 'IT0DEMO00301', name: 'Fondo Bilanciato Prudente', type: 'FUND', issuer: 'Demo SGR', assetClass: 'fondi', price: 13.94 },
  { isin: 'IT0DEMO00302', name: 'Fondo Bilanciato Dinamico', type: 'FUND', issuer: 'Demo SGR', assetClass: 'fondi', price: 17.62 },
  { isin: 'IT0DEMO00303', name: 'Fondo Multi-Asset Income', type: 'FUND', issuer: 'Demo Asset Management', assetClass: 'fondi', price: 26.18 },
  { isin: 'IT0DEMO00304', name: 'ETF Portafoglio 60/40', type: 'ETF', issuer: 'Demo Index Solutions', assetClass: 'fondi', price: 41.37 },
  { isin: 'IT0DEMO00305', name: 'Fondo Pensione Aperto Demo', type: 'FUND', issuer: 'Demo Previdenza', assetClass: 'fondi', price: 22.45 },
  { isin: 'IT0DEMO00401', name: 'Conto liquidità', type: 'CASH', issuer: 'Banca Simulata', assetClass: 'liquidita', price: 1 },
  { isin: 'IT0DEMO00501', name: 'Fondo Private Markets Demo', type: 'FUND', issuer: 'Demo Alternative', assetClass: 'alternativi', price: 132.8 },
  { isin: 'IT0DEMO00502', name: 'ETF Materie Prime', type: 'ETF', issuer: 'Demo Index Solutions', assetClass: 'alternativi', price: 29.44 },
  { isin: 'IT0DEMO00503', name: 'Strategia Absolute Return', type: 'FUND', issuer: 'Demo Asset Management', assetClass: 'alternativi', price: 61.09 },
  { isin: 'IT0DEMO00601', name: 'Fondo Monetario Euro', type: 'FUND', issuer: 'Demo SGR', assetClass: 'monetario', price: 10.42 },
  { isin: 'IT0DEMO00602', name: 'ETF Monetario Breve Termine', type: 'ETF', issuer: 'Demo Index Solutions', assetClass: 'monetario', price: 100.85 },
] as const;

const ADVISOR_NAMES = [
  { firstName: 'Giulia', lastName: 'Ferrari', city: 'Milano' },
  { firstName: 'Marco', lastName: 'Conti', city: 'Roma' },
  { firstName: 'Elena', lastName: 'Ricci', city: 'Torino' },
  { firstName: 'Davide', lastName: 'Greco', city: 'Bologna' },
  { firstName: 'Sara', lastName: 'Marino', city: 'Firenze' },
  { firstName: 'Luca', lastName: 'Barbieri', city: 'Padova' },
];

const CLIENT_NAMES = [
  { firstName: 'Mario', lastName: 'Rossi' },
  { firstName: 'Luca', lastName: 'Bianchi' },
  { firstName: 'Anna', lastName: 'Verdi' },
  { firstName: 'Paolo', lastName: 'Gallo' },
  { firstName: 'Chiara', lastName: 'Costa' },
  { firstName: 'Francesco', lastName: 'Fontana' },
  { firstName: 'Silvia', lastName: 'Caruso' },
  { firstName: 'Alessandro', lastName: 'Rizzo' },
  { firstName: 'Martina', lastName: 'Lombardi' },
  { firstName: 'Giorgio', lastName: 'Moretti' },
  { firstName: 'Valentina', lastName: 'Colombo', },
  { firstName: 'Stefano', lastName: 'Bruno' },
  { firstName: 'Federica', lastName: 'Villa' },
  { firstName: 'Roberto', lastName: 'Sala' },
  { firstName: 'Laura', lastName: 'Pellegrini' },
  { firstName: 'Andrea', lastName: 'Longo' },
  { firstName: 'Beatrice', lastName: 'Mancini' },
  { firstName: 'Simone', lastName: 'Grassi' },
  { firstName: 'Claudia', lastName: 'Neri' },
  { firstName: 'Matteo', lastName: 'Serra' },
];

const CITIES = ['Milano', 'Roma', 'Torino', 'Bologna', 'Firenze', 'Padova', 'Verona', 'Genova', 'Bergamo', 'Brescia'];
const AVATAR_COLORS = ['#1F3A5F', '#2563EB', '#0F766E', '#7C3AED', '#B45309', '#9D174D', '#155E75', '#3F6212'];
const RISK_PROFILES = ['PRUDENTE', 'BILANCIATO', 'DINAMICO', 'AGGRESSIVO'] as const;

// ---------------------------------------------------------------------------
// Utilità
// ---------------------------------------------------------------------------

function slugEmail(firstName: string, lastName: string, domainPrefix: string): string {
  return `${firstName}.${lastName}`.toLowerCase().normalize('NFD').replace(/[^a-z.]/g, '') + `@${domainPrefix}.demo.local`;
}

function maskedTaxCode(index: number): string {
  return `****${String(1000 + index).slice(-4)}****DEMO`;
}

function maskedIban(index: number): string {
  return `IT** **** **** **** **** ${String(1000 + index).slice(-4)}`;
}

async function chunkedCreateMany<T>(rows: T[], size: number, create: (chunk: T[]) => Promise<unknown>) {
  for (let i = 0; i < rows.length; i += size) {
    await create(rows.slice(i, i + size));
  }
}

// ---------------------------------------------------------------------------
// Seed
// ---------------------------------------------------------------------------

async function clearDatabase() {
  // Ordine coerente con le chiavi esterne.
  await prisma.auditLog.deleteMany();
  await prisma.document.deleteMany();
  await prisma.proposalAllocation.deleteMany();
  await prisma.proposalItem.deleteMany();
  await prisma.proposal.deleteMany();
  await prisma.snapshotAllocation.deleteMany();
  await prisma.portfolioSnapshot.deleteMany();
  await prisma.transaction.deleteMany();
  await prisma.holding.deleteMany();
  await prisma.portfolio.deleteMany();
  await prisma.client.deleteMany();
  await prisma.advisor.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.user.deleteMany();
  await prisma.instrument.deleteMany();
  await prisma.assetClass.deleteMany();
}

async function main() {
  const startedAt = Date.now();
  console.log('\n── Seed dati dimostrativi ──────────────────────────────────');

  await clearDatabase();

  const passwordHash = await bcrypt.hash(env.auth.demoPassword, 10);
  const today = startOfUTCDay(new Date());
  const historyDays = env.seed.historyDays;
  const firstDay = addDays(today, -(historyDays - 1));

  // --- Asset class ----------------------------------------------------------
  await prisma.assetClass.createMany({
    data: ASSET_CLASSES.map(({ key, label, colorHex, orderIndex, riskLevel, description }) => ({
      id: `ac_${key}`,
      key,
      label,
      colorHex,
      orderIndex,
      riskLevel,
      description,
    })),
  });

  // --- Strumenti ------------------------------------------------------------
  await prisma.instrument.createMany({
    data: INSTRUMENTS.map((instrument, index) => ({
      id: `ins_${index + 1}`,
      isin: instrument.isin,
      name: instrument.name,
      type: instrument.type,
      issuer: instrument.issuer,
      currency: 'EUR',
      assetClassId: `ac_${instrument.assetClass}`,
      description: `Strumento dimostrativo — ${instrument.name}`,
    })),
  });

  const instrumentsByClass = new Map<string, Array<{ id: string; price: number; name: string }>>();
  INSTRUMENTS.forEach((instrument, index) => {
    const list = instrumentsByClass.get(instrument.assetClass) ?? [];
    list.push({ id: `ins_${index + 1}`, price: instrument.price, name: instrument.name });
    instrumentsByClass.set(instrument.assetClass, list);
  });

  // --- Direzione ------------------------------------------------------------
  await prisma.user.create({
    data: {
      id: 'usr_admin',
      email: 'direzione@demo.local',
      passwordHash,
      role: 'ADMIN',
      firstName: 'Direzione',
      lastName: 'Generale',
      phone: '+39 02 0000 0000',
      avatarColor: '#1F3A5F',
    },
  });

  // --- Consulenti -----------------------------------------------------------
  const advisorCount = Math.min(env.seed.advisors, ADVISOR_NAMES.length);
  const advisors: Array<{ id: string; name: string; city: string }> = [];

  for (let i = 0; i < advisorCount; i += 1) {
    const person = ADVISOR_NAMES[i];
    const userId = `usr_adv_${i + 1}`;
    const advisorId = `adv_${i + 1}`;

    await prisma.user.create({
      data: {
        id: userId,
        email: slugEmail(person.firstName, person.lastName, 'consulente'),
        passwordHash,
        role: 'ADVISOR',
        firstName: person.firstName,
        lastName: person.lastName,
        phone: `+39 3${rng.int(20, 99)} ${rng.int(1000000, 9999999)}`,
        avatarColor: AVATAR_COLORS[i % AVATAR_COLORS.length],
      },
    });

    await prisma.advisor.create({
      data: {
        id: advisorId,
        userId,
        code: `CNS-${String(i + 1).padStart(3, '0')}`,
        officeCity: person.city,
        bio: `Consulente finanziario, filiale di ${person.city}. Profilo dimostrativo.`,
        hiredAt: addDays(today, -rng.int(700, 3600)),
      },
    });

    advisors.push({ id: advisorId, name: `${person.firstName} ${person.lastName}`, city: person.city });
  }

  // --- Clienti, portafogli, storico ----------------------------------------
  const clientCount = Math.min(env.seed.clients, CLIENT_NAMES.length);
  const createdClients: Array<{
    id: string;
    advisorId: string;
    name: string;
    riskProfile: string;
    finalValue: number;
    weights: Array<{ key: AssetClassKey; weightPct: number; value: number }>;
  }> = [];

  console.log(`  • ${advisorCount} consulenti, ${clientCount} clienti, ${historyDays} giorni di storico`);

  for (let i = 0; i < clientCount; i += 1) {
    const person = CLIENT_NAMES[i];
    const userId = `usr_cli_${i + 1}`;
    const clientId = `cli_${i + 1}`;
    const portfolioId = `prt_${i + 1}`;
    // Al consulente demo (il primo) viene assegnata una quota maggiore di
    // clienti: la sua area risulta così più ricca durante la presentazione.
    const demoShare = Math.max(1, Math.round(clientCount * 0.35));
    const advisor =
      advisors.length === 1 || i < demoShare
        ? advisors[0]
        : advisors[1 + ((i - demoShare) % (advisors.length - 1))];

    // Il primo cliente è l'account demo "vetrina": profilo bilanciato, valori tondi.
    const riskProfile = i === 0 ? 'BILANCIATO' : rng.pick(RISK_PROFILES);

    await prisma.user.create({
      data: {
        id: userId,
        email: slugEmail(person.firstName, person.lastName, 'cliente'),
        passwordHash,
        role: 'CLIENT',
        firstName: person.firstName,
        lastName: person.lastName,
        phone: `+39 3${rng.int(20, 99)} ${rng.int(1000000, 9999999)}`,
        avatarColor: AVATAR_COLORS[(i + 3) % AVATAR_COLORS.length],
      },
    });

    const onboardedAt = addDays(firstDay, -rng.int(30, 900));

    await prisma.client.create({
      data: {
        id: clientId,
        userId,
        advisorId: advisor.id,
        clientCode: `CLI-${String(i + 1).padStart(4, '0')}`,
        riskProfile,
        birthDate: new Date(Date.UTC(rng.int(1955, 1995), rng.int(0, 11), rng.int(1, 28))),
        city: i === 0 ? 'Milano' : rng.pick(CITIES),
        taxCodeMasked: maskedTaxCode(i + 1),
        ibanMasked: maskedIban(i + 1),
        onboardedAt,
      },
    });

    await prisma.portfolio.create({
      data: {
        id: portfolioId,
        clientId,
        name: 'Portafoglio principale',
        baseCurrency: 'EUR',
        openedAt: onboardedAt,
      },
    });

    // --- Generazione della serie storica ------------------------------------
    const targets = TARGET_ALLOCATION[riskProfile];
    const activeClasses = ASSET_CLASSES.filter((assetClass) => (targets[assetClass.key] ?? 0) > 0);
    const normalized = normalizeWeights(activeClasses.map((assetClass) => targets[assetClass.key] ?? 0));

    // Patrimonio iniziale per fasce: rende la demo variata e credibile.
    const initialValue =
      i === 0
        ? 228_000
        : rng.pick([95_000, 140_000, 190_000, 260_000, 380_000, 540_000, 720_000, 1_150_000, 1_680_000]) *
          rng.float(0.9, 1.12);

    const values = activeClasses.map((assetClass, index) => (initialValue * normalized[index]) / 100);
    let contributions = initialValue;

    const snapshotRows: Array<Record<string, unknown>> = [];
    const allocationRows: Array<Record<string, unknown>> = [];
    const depositEvents: Array<{ date: Date; amount: number }> = [];

    for (let day = 0; day < historyDays; day += 1) {
      const date = addDays(firstDay, day);
      const weekend = isWeekend(date);

      for (let c = 0; c < activeClasses.length; c += 1) {
        const assetClass = activeClasses[c];
        if (weekend) continue; // mercati chiusi: valore invariato
        const dailyDrift = assetClass.drift / 252;
        const dailyVol = assetClass.vol / Math.sqrt(252);
        values[c] = Math.max(0, values[c] * (1 + rng.normal(dailyDrift, dailyVol)));
      }

      // Versamento periodico (circa ogni 3 mesi) sulla liquidità.
      const liquidityIndex = activeClasses.findIndex((assetClass) => assetClass.key === 'liquidita');
      if (!weekend && day > 0 && day % 92 === 0 && liquidityIndex >= 0) {
        const amount = money(rng.float(2_000, 9_000));
        values[liquidityIndex] += amount;
        contributions += amount;
        depositEvents.push({ date, amount });
      }

      const total = values.reduce((acc, value) => acc + value, 0);
      const cash = liquidityIndex >= 0 ? values[liquidityIndex] : 0;
      const snapshotId = `snp_${i + 1}_${day}`;

      snapshotRows.push({
        id: snapshotId,
        portfolioId,
        date,
        totalValue: money(total),
        investedValue: money(total - cash),
        cashValue: money(cash),
        pnlAbs: money(total - contributions),
        pnlPct: contributions > 0 ? pct(((total - contributions) / contributions) * 100) : 0,
      });

      for (let c = 0; c < activeClasses.length; c += 1) {
        allocationRows.push({
          id: `alc_${i + 1}_${day}_${c}`,
          snapshotId,
          assetClassId: `ac_${activeClasses[c].key}`,
          value: money(values[c]),
          weightPct: total > 0 ? pct((values[c] / total) * 100) : 0,
        });
      }
    }

    await chunkedCreateMany(snapshotRows, 1000, (chunk) =>
      prisma.portfolioSnapshot.createMany({ data: chunk as never }),
    );
    await chunkedCreateMany(allocationRows, 2000, (chunk) =>
      prisma.snapshotAllocation.createMany({ data: chunk as never }),
    );

    const finalTotal = values.reduce((acc, value) => acc + value, 0);

    // --- Posizioni finali ---------------------------------------------------
    const holdingRows: Array<Record<string, unknown>> = [];
    const transactionRows: Array<Record<string, unknown>> = [];
    let holdingIndex = 0;

    for (let c = 0; c < activeClasses.length; c += 1) {
      const assetClass = activeClasses[c];
      const pool = instrumentsByClass.get(assetClass.key) ?? [];
      if (pool.length === 0) continue;

      const picks = assetClass.key === 'liquidita' ? [pool[0]] : rng.sample(pool, Math.min(pool.length, rng.int(1, 2)));
      const shares = normalizeWeights(picks.map(() => 100 / picks.length));

      picks.forEach((instrument, index) => {
        const marketValue = money((values[c] * shares[index]) / 100);
        if (marketValue < 1) return;

        const gainRatio = rng.float(0.88, 1.34);
        const costBasis = money(marketValue / gainRatio);
        const currentPrice = money(instrument.price);
        const quantity = Math.round((marketValue / currentPrice) * 10000) / 10000;
        const avgPrice = quantity > 0 ? money(costBasis / quantity) : currentPrice;
        const openedAt = addDays(firstDay, rng.int(0, Math.max(1, Math.floor(historyDays * 0.4))));

        holdingIndex += 1;
        holdingRows.push({
          id: `hld_${i + 1}_${holdingIndex}`,
          portfolioId,
          instrumentId: instrument.id,
          quantity,
          avgPrice,
          currentPrice,
          costBasis,
          marketValue,
          openedAt,
        });

        transactionRows.push({
          portfolioId,
          instrumentId: instrument.id,
          date: openedAt,
          type: 'BUY',
          amount: costBasis,
          quantity,
          price: avgPrice,
          currency: 'EUR',
          description: `Acquisto ${instrument.name}`,
        });

        // Qualche cedola/dividendo per rendere lo storico movimenti realistico.
        if (rng.bool(0.55)) {
          transactionRows.push({
            portfolioId,
            instrumentId: instrument.id,
            date: addDays(openedAt, rng.int(60, Math.max(61, historyDays - 10))),
            type: assetClass.key === 'obbligazionario' ? 'COUPON' : 'DIVIDEND',
            amount: money(marketValue * rng.float(0.004, 0.021)),
            quantity: null,
            price: null,
            currency: 'EUR',
            description: assetClass.key === 'obbligazionario' ? `Cedola ${instrument.name}` : `Dividendo ${instrument.name}`,
          });
        }
      });
    }

    for (const deposit of depositEvents) {
      transactionRows.push({
        portfolioId,
        instrumentId: null,
        date: deposit.date,
        type: 'DEPOSIT',
        amount: deposit.amount,
        quantity: null,
        price: null,
        currency: 'EUR',
        description: 'Versamento su conto',
      });
    }

    // Commissioni di gestione trimestrali.
    for (let q = 1; q <= Math.floor(historyDays / 92); q += 1) {
      transactionRows.push({
        portfolioId,
        instrumentId: null,
        date: addDays(firstDay, q * 92),
        type: 'FEE',
        amount: money(-finalTotal * 0.0012),
        quantity: null,
        price: null,
        currency: 'EUR',
        description: 'Commissioni di gestione trimestrali',
      });
    }

    await prisma.holding.createMany({ data: holdingRows as never });
    await chunkedCreateMany(transactionRows, 500, (chunk) =>
      prisma.transaction.createMany({ data: chunk as never }),
    );

    createdClients.push({
      id: clientId,
      advisorId: advisor.id,
      name: `${person.firstName} ${person.lastName}`,
      riskProfile,
      finalValue: money(finalTotal),
      weights: activeClasses.map((assetClass, index) => ({
        key: assetClass.key,
        weightPct: finalTotal > 0 ? pct((values[index] / finalTotal) * 100) : 0,
        value: money(values[index]),
      })),
    });

    process.stdout.write(`\r  • clienti generati: ${i + 1}/${clientCount}   `);
  }

  process.stdout.write('\n');

  // --- Proposte -------------------------------------------------------------
  console.log('  • generazione proposte e documenti...');

  const PROPOSAL_TEMPLATES = [
    {
      title: 'Ribilanciamento del portafoglio',
      description:
        'Il peso della componente azionaria è cresciuto oltre il profilo concordato. Proponiamo un riallineamento verso l\'allocazione obiettivo, riducendo il rischio complessivo senza rinunciare al potenziale di crescita.',
      rationale: 'Riallineamento al profilo di rischio e riduzione della concentrazione settoriale.',
    },
    {
      title: 'Ingresso graduale sui mercati obbligazionari',
      description:
        'I rendimenti attuali sulla parte a medio termine rendono interessante un incremento della componente obbligazionaria, con ingresso scaglionato in tre tranche trimestrali.',
      rationale: 'Consolidamento del rendimento atteso con volatilità contenuta.',
    },
    {
      title: 'Diversificazione su strumenti alternativi',
      description:
        'Proponiamo l\'inserimento di una quota contenuta di strumenti alternativi, con l\'obiettivo di ridurre la correlazione complessiva del portafoglio.',
      rationale: 'Decorrelazione e miglioramento del profilo rischio/rendimento.',
    },
    {
      title: 'Impiego della liquidità in eccesso',
      description:
        'La liquidità disponibile supera la soglia concordata. Proponiamo di destinarne una parte a strumenti monetari e a un fondo bilanciato, mantenendo il capitale prontamente disponibile.',
      rationale: 'Riduzione dell\'erosione da inflazione sulla liquidità non impiegata.',
    },
    {
      title: 'Piano di accumulo su fondo bilanciato',
      description:
        'Attivazione di un piano di accumulo mensile su un fondo bilanciato, per costruire gradualmente la posizione riducendo l\'impatto della volatilità di ingresso.',
      rationale: 'Mediazione del prezzo di ingresso e disciplina di investimento.',
    },
  ];

  const STATUS_PLAN: Array<{ status: string; ageDays: number; expiresInDays: number }> = [
    { status: 'PENDING', ageDays: 3, expiresInDays: 11 },
    { status: 'PENDING', ageDays: 8, expiresInDays: 6 },
    { status: 'ACCEPTED', ageDays: 20, expiresInDays: -6 },
    { status: 'ACCEPTED', ageDays: 45, expiresInDays: -31 },
    { status: 'REJECTED', ageDays: 70, expiresInDays: -56 },
    { status: 'EXPIRED', ageDays: 120, expiresInDays: -106 },
  ];

  let proposalCounter = 0;
  const generatedProposals: Array<{ id: string; status: string }> = [];

  for (let i = 0; i < createdClients.length; i += 1) {
    const client = createdClients[i];

    // Il cliente demo riceve un mix completo; gli altri da 1 a 4 proposte.
    const plan = i === 0 ? STATUS_PLAN : rng.sample(STATUS_PLAN, rng.int(1, 4));

    for (const entry of plan) {
      proposalCounter += 1;
      const template = PROPOSAL_TEMPLATES[proposalCounter % PROPOSAL_TEMPLATES.length];
      const createdAt = addDays(today, -entry.ageDays);
      const expiresAt = addDays(today, entry.expiresInDays);
      const amount = money(client.finalValue * rng.float(0.05, 0.22));
      const proposalId = `prp_${proposalCounter}`;

      // Operazioni coerenti con l'importo proposto.
      const itemCount = rng.int(1, 3);
      const itemShares = normalizeWeights(Array.from({ length: itemCount }, () => 100 / itemCount));
      const pool = INSTRUMENTS.filter((instrument) => instrument.assetClass !== 'liquidita');
      const chosen = rng.sample(pool, itemCount);

      const items = chosen.map((instrument, index) => {
        const instrumentIndex = INSTRUMENTS.findIndex((candidate) => candidate.isin === instrument.isin);
        return {
          instrumentId: `ins_${instrumentIndex + 1}`,
          instrumentName: instrument.name,
          assetClassId: `ac_${instrument.assetClass}`,
          action: index === 0 ? 'BUY' : rng.pick(['BUY', 'SWITCH'] as const),
          amount: money((amount * itemShares[index]) / 100),
          weightPct: itemShares[index],
          note: null,
        };
      });

      // Allocazione proposta: si sposta di qualche punto rispetto all'attuale.
      const allocation = client.weights.map((weight) => {
        const shift = rng.float(-4, 4);
        return { key: weight.key, currentPct: weight.weightPct, proposedRaw: Math.max(0, weight.weightPct + shift) };
      });
      const proposedNormalized = normalizeWeights(allocation.map((row) => row.proposedRaw));

      await prisma.proposal.create({
        data: {
          id: proposalId,
          code: `PRP-${createdAt.getUTCFullYear()}-${String(proposalCounter).padStart(4, '0')}`,
          clientId: client.id,
          advisorId: client.advisorId,
          title: template.title,
          description: template.description,
          rationale: template.rationale,
          amount,
          currency: 'EUR',
          status: entry.status,
          createdAt,
          expiresAt,
          viewedAt: entry.status === 'PENDING' ? null : addDays(createdAt, 1),
          respondedAt:
            entry.status === 'ACCEPTED' || entry.status === 'REJECTED' ? addDays(createdAt, rng.int(1, 6)) : null,
          responseNote:
            entry.status === 'REJECTED'
              ? 'Preferisco attendere: ne riparliamo al prossimo incontro.'
              : entry.status === 'ACCEPTED'
                ? 'Va bene, procediamo.'
                : null,
          items: { create: items },
          allocations: {
            create: allocation.map((row, index) => ({
              assetClassId: `ac_${row.key}`,
              currentPct: pct(row.currentPct),
              proposedPct: proposedNormalized[index],
            })),
          },
        },
      });

      generatedProposals.push({ id: proposalId, status: entry.status });
    }
  }

  // --- Documenti PDF fittizi ------------------------------------------------
  for (const proposal of generatedProposals) {
    await generateProposalDocument(proposal.id);
  }

  // Un rendiconto periodico per ciascun cliente.
  for (const client of createdClients) {
    await storeGeneratedDocument({
      clientId: client.id,
      title: `Rendiconto periodico — ${toISODate(today)}`,
      category: 'STATEMENT',
      fileName: `rendiconto-${client.id}.pdf`,
      spec: {
        title: 'Rendiconto periodico',
        subtitle: client.name,
        reference: `Aggiornato al ${toISODate(today)}`,
        sections: [
          {
            heading: 'Sintesi del patrimonio',
            rows: [
              { label: 'Patrimonio complessivo', value: formatEur(client.finalValue) },
              { label: 'Profilo di rischio', value: client.riskProfile },
            ],
          },
          {
            heading: 'Composizione per asset class',
            rows: client.weights.map((weight) => ({
              label: ASSET_CLASSES.find((assetClass) => assetClass.key === weight.key)?.label ?? weight.key,
              value: `${weight.weightPct.toFixed(1)}%  ·  ${formatEur(weight.value)}`,
            })),
          },
        ],
      },
    });
  }

  // --- Riepilogo ------------------------------------------------------------
  const [users, clients, portfolios, snapshots, holdings, transactions, proposals, documents] = await Promise.all([
    prisma.user.count(),
    prisma.client.count(),
    prisma.portfolio.count(),
    prisma.portfolioSnapshot.count(),
    prisma.holding.count(),
    prisma.transaction.count(),
    prisma.proposal.count(),
    prisma.document.count(),
  ]);

  const statusCounts = await prisma.proposal.groupBy({ by: ['status'], _count: { status: true } });
  const totalAum = createdClients.reduce((acc, client) => acc + client.finalValue, 0);

  console.log('\n── Dati creati ─────────────────────────────────────────────');
  console.log(`  utenti ${users} · clienti ${clients} · portafogli ${portfolios}`);
  console.log(`  rilevazioni storiche ${snapshots} · posizioni ${holdings} · movimenti ${transactions}`);
  console.log(`  proposte ${proposals} (${statusCounts.map((row) => `${row.status}: ${row._count.status}`).join(', ')})`);
  console.log(`  documenti PDF ${documents}`);
  console.log(`  patrimonio complessivo ${formatEur(money(totalAum))}`);

  console.log('\n── Account dimostrativi (password unica) ───────────────────');
  console.log(`  password: ${env.auth.demoPassword}`);
  console.log(`  CLIENTE     ${slugEmail(CLIENT_NAMES[0].firstName, CLIENT_NAMES[0].lastName, 'cliente')}`);
  console.log(`  CONSULENTE  ${slugEmail(ADVISOR_NAMES[0].firstName, ADVISOR_NAMES[0].lastName, 'consulente')}`);
  console.log('  BOSS        direzione@demo.local');
  console.log(`\nCompletato in ${((Date.now() - startedAt) / 1000).toFixed(1)}s\n`);
}

main()
  .catch((error) => {
    console.error('\nSeed non riuscito:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
