// ================================================================
//  ml-model.js — TensorFlow.js ML model for moisture prediction
//
//  Architecture : Dense(32) → Dense(16) → Dense(8) → Dense(1)
//  Input        : [moisture, elapsed_hours, predicted_hours, phase]
//  Output       : hours_until_dry (regression)
//  Training     : 200 synthetic watering cycles (~3k+ samples)
//  Fine-tuning  : retrained on live cycle data after each pump fire
// ================================================================

let model = null;

// ----------------------------------------------------------------
//  Normalisation helpers (keep inputs ≈ 0–1)
// ----------------------------------------------------------------
const normM = v => v / 100;          // moisture 0–100  → 0–1
const normH = v => v / 50;           // hours    0–50   → 0–1
const normP = v => v / 3;            // phase    0–3    → 0–1
const denormH = v => v * 50;         // back to hours

// ----------------------------------------------------------------
//  Synthetic Training Data Generator
//  Simulates ~200 full watering cycles with randomised dry rates
//  and noise, sampling features at multiple points each cycle.
// ----------------------------------------------------------------
function generateSyntheticData() {
    const inputs = [], outputs = [];

    for (let c = 0; c < 200; c++) {
        const startM   = 80 + Math.random() * 20;             // 80–100 %
        const rate     = 2 + Math.random() * 6;               // 2–8 %/h
        const trueCycle = (startM - DRY_THRESHOLD) / rate;
        let pred = trueCycle * (0.7 + Math.random() * 0.6);   // imperfect initial pred

        let m = startM, t = 0;

        while (m > 15 && t < 60) {
            const ph       = getPhaseNumber(t, pred);
            const hoursLeft = Math.max(0, (m - DRY_THRESHOLD) / rate);

            inputs.push([normM(m), normH(t), normH(pred), normP(ph)]);
            outputs.push([normH(hoursLeft)]);

            const step = 0.3 + Math.random() * 0.7;
            t += step;
            m -= rate * step + (Math.random() - 0.5) * 1.2;   // noise
            m  = Math.max(0, Math.min(100, m));
        }
    }
    return { inputs, outputs };
}

// ----------------------------------------------------------------
//  Build & Train the model from synthetic data
// ----------------------------------------------------------------
async function buildAndTrainModel() {
    if (typeof tf === 'undefined') {
        serialLog('[ML] TensorFlow.js not available — using EMA only', 'warn');
        return;
    }

    serialLog('[ML] Generating synthetic training data...', 'info');
    const data = generateSyntheticData();
    serialLog(`[ML] ${data.inputs.length} samples generated`, 'info');

    // ---- Model architecture ----
    model = tf.sequential();
    model.add(tf.layers.dense({ inputShape: [4], units: 32, activation: 'relu' }));
    model.add(tf.layers.dense({ units: 16, activation: 'relu' }));
    model.add(tf.layers.dense({ units: 8,  activation: 'relu' }));
    model.add(tf.layers.dense({ units: 1,  activation: 'linear' }));

    model.compile({
        optimizer: tf.train.adam(0.001),
        loss: 'meanSquaredError'
    });

    const xs = tf.tensor2d(data.inputs);
    const ys = tf.tensor2d(data.outputs);

    updateMLStatus('Training model...', true);
    serialLog('[ML] Training started (50 epochs)...', 'info');

    await model.fit(xs, ys, {
        epochs: 50,
        batchSize: 64,
        validationSplit: 0.15,
        shuffle: true,
        callbacks: {
            onEpochEnd: (epoch, logs) => {
                if ((epoch + 1) % 10 === 0 || epoch === 0) {
                    serialLog(
                        `[ML] Epoch ${epoch + 1}/50  loss=${logs.loss.toFixed(5)}  val=${logs.val_loss.toFixed(5)}`,
                        'info'
                    );
                    updateMLStatus(`Training... Epoch ${epoch + 1}/50`, true);
                }
                state.trainingLoss = logs.val_loss;
            }
        }
    });

    xs.dispose();
    ys.dispose();

    state.modelReady   = true;
    state.mlConfidence = Math.min(95, Math.max(30, 100 * (1 - Math.sqrt(state.trainingLoss))));

    serialLog('[ML] Model trained successfully ✓', 'info');
    updateMLStatus('Model ready', false);
}

// ----------------------------------------------------------------
//  Fine-tune on real cycle data (called after each pump fire)
// ----------------------------------------------------------------
async function fineTuneModel(samples) {
    if (!model || samples.length === 0) return;

    const xs = tf.tensor2d(samples.map(s => s.input));
    const ys = tf.tensor2d(samples.map(s => s.output));

    await model.fit(xs, ys, {
        epochs: 10,
        batchSize: Math.min(32, samples.length),
        callbacks: {
            onEpochEnd: (_, logs) => { state.trainingLoss = logs.loss; }
        }
    });

    xs.dispose();
    ys.dispose();

    state.mlConfidence = Math.min(98, state.mlConfidence + 1.5);
    serialLog('[ML] Fine-tuned on live cycle data', 'info');
}

// ----------------------------------------------------------------
//  Single-shot prediction: returns hours_until_dry (or null)
// ----------------------------------------------------------------
function predictML() {
    if (!model || !state.modelReady) return null;

    const input = tf.tensor2d([[
        normM(state.moisture),
        normH(state.elapsedHours),
        normH(state.predictedHours),
        normP(state.phase)
    ]]);

    const pred = model.predict(input);
    const val  = denormH(pred.dataSync()[0]);

    input.dispose();
    pred.dispose();

    return Math.max(0, val);
}

// ----------------------------------------------------------------
//  ML status bar helper (updates the UI indicator)
// ----------------------------------------------------------------
function updateMLStatus(text, isTraining) {
    const textEl = $('ml-status-text');
    const dotEl  = $('ml-status-dot');
    if (textEl) textEl.textContent = text;
    if (dotEl)  dotEl.classList.toggle('training', isTraining);
}
