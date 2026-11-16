require('dotenv').config();
const express = require('express');
const multer = require('multer');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { Client } = require('@gradio/client');

const app = express();
app.use(cors());
app.use(['/models', '/temp_uploads'], (req, res) => res.sendStatus(404));
app.use(express.static(__dirname));

app.get('/api/health', (req, res) => {
    const models = [2, 4].map(scale => {
        const modelPath = path.join(__dirname, 'models', `realesrgan-x${scale}.onnx`);
        return fs.existsSync(modelPath) && fs.statSync(modelPath).size > 0;
    });

    if (models.every(Boolean)) {
        return res.json({ status: 'ok', models: { x2: 'ready', x4: 'ready' } });
    }

    return res.status(503).json({
        status: 'unavailable',
        models: { x2: models[0] ? 'ready' : 'missing', x4: models[1] ? 'ready' : 'missing' }
    });
});

// Multer setup using diskStorage to allow clean passing to Python engine
const uploadDir = path.join(__dirname, 'temp_uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, 'input-' + uniqueSuffix + path.extname(file.originalname || '.jpg'));
    }
});

const upload = multer({ 
    storage,
    limits: { fileSize: 25 * 1024 * 1024 } // 25 MB max
});

// Helper: Run Local Real-ESRGAN Neural Engine
function runLocalRealESRGAN(inputPath, outputPath, scale) {
    return new Promise((resolve, reject) => {
        const args = [
            path.join(__dirname, 'restore.py'),
            '--input', inputPath,
            '--output', outputPath,
            '--scale', String(scale || 2)
        ];
        console.log(`[Neural Pipeline] Invoking Local Engine (scale: x${scale})...`);
        const pythonProcess = spawn(process.env.PYTHON || 'python', args, {
            env: { ...process.env, PYTHONIOENCODING: 'utf-8' }
        });

        let stdout = '';
        let stderr = '';

        pythonProcess.stdout.on('data', data => {
            stdout += data.toString();
            console.log(data.toString().trim());
        });

        pythonProcess.stderr.on('data', data => {
            stderr += data.toString();
            console.error(data.toString().trim());
        });

        pythonProcess.on('close', code => {
            if (code === 0 && fs.existsSync(outputPath)) {
                console.log('[Neural Pipeline] Local Real-ESRGAN inference succeeded.');
                resolve(outputPath);
            } else {
                reject(new Error(`Local neural engine exited with code ${code}: ${stderr || stdout}`));
            }
        });

        pythonProcess.on('error', err => reject(err));
    });
}

// Helper: Run Cloud CodeFormer + Real-ESRGAN Pipeline
async function runCloudCodeFormer(inputBuffer, mimeType, scale, fidelity) {
    console.log('[Neural Pipeline] Connecting to Cloud CodeFormer + Real-ESRGAN Space...');
    const clientOpts = process.env.HF_TOKEN ? { hf_token: process.env.HF_TOKEN } : {};
    const app = await Client.connect('sczhou/CodeFormer', clientOpts);

    const blob = new Blob([inputBuffer], { type: mimeType || 'image/jpeg' });
    console.log('[Neural Pipeline] Submitting image to CodeFormer ZeroGPU inference queue...');

    const result = await Promise.race([
        app.predict('/inference', [
            blob,
            true,                       // face_align
            true,                       // background_enhance (Real-ESRGAN)
            true,                       // face_upsample
            parseInt(scale, 10) || 2,   // upscale
            parseFloat(fidelity) || 0.6 // codeformer_fidelity
        ]),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Cloud inference timed out after 35s')), 35000))
    ]);

    if (!result || !result.data || !result.data[0] || !result.data[0].url) {
        throw new Error('Cloud inference returned empty payload.');
    }

    const outputUrl = result.data[0].url;
    console.log('[Neural Pipeline] Cloud inference successful. Fetching restored asset from:', outputUrl);
    const res = await fetch(outputUrl);
    const arrayBuffer = await res.arrayBuffer();
    return Buffer.from(arrayBuffer);
}

// REST API Endpoint
app.post('/api/restore', upload.single('image'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No image uploaded.' });
    }

    const inputPath = req.file.path;
    const scale = parseInt(req.body.scale, 10) === 4 ? 4 : 2;
    const mode = req.body.mode || 'auto'; // 'auto', 'local', or 'cloud'
    const fidelity = parseFloat(req.body.fidelity) || 0.6;
    const outputPath = path.join(uploadDir, `output-${Date.now()}-${scale}x.png`);

    console.log(`\n========================================`);
    console.log(`[PhotoRevive] Ingested image: ${req.file.originalname} (${(req.file.size / 1024).toFixed(1)} KB)`);
    console.log(`[PhotoRevive] Parameters - Mode: ${mode}, Scale: ${scale}x, Fidelity: ${fidelity}`);

    let processedBuffer = null;
    let engineUsed = '';

    // 1. Attempt Cloud CodeFormer if requested or in auto mode with HF token
    if (mode === 'cloud' || (mode === 'auto' && process.env.HF_TOKEN)) {
        try {
            const rawBuffer = fs.readFileSync(inputPath);
            processedBuffer = await runCloudCodeFormer(rawBuffer, req.file.mimetype, scale, fidelity);
            engineUsed = 'CodeFormer + Real-ESRGAN (Cloud GPU)';
        } catch (cloudErr) {
            console.warn(`[PhotoRevive] Cloud pipeline bypassed or failed: ${cloudErr.message}`);
            if (mode === 'cloud') {
                cleanupFiles([inputPath, outputPath]);
                return res.status(502).json({ error: `Cloud GPU pipeline unavailable: ${cloudErr.message}` });
            }
            console.log('[PhotoRevive] Seamlessly falling back to Local Real-ESRGAN Neural Engine...');
        }
    }

    // 2. Local Neural Engine (Runs whenever cloud is bypassed, offline, or local mode is chosen)
    if (!processedBuffer) {
        try {
            await runLocalRealESRGAN(inputPath, outputPath, scale);
            processedBuffer = fs.readFileSync(outputPath);
            engineUsed = `Real-ESRGAN x${scale} Neural Engine (Local)`;
        } catch (localErr) {
            console.error('[PhotoRevive] Local neural engine error:', localErr);
            cleanupFiles([inputPath, outputPath]);
            return res.status(500).json({ error: 'Neural processing failed: ' + localErr.message });
        }
    }

    // Clean up temporary files
    cleanupFiles([inputPath, outputPath]);

    console.log(`[PhotoRevive] Finished processing via ${engineUsed}. Returning ${(processedBuffer.length / 1024).toFixed(1)} KB PNG.`);
    console.log(`========================================\n`);

    res.set('Content-Type', 'image/png');
    res.set('X-Restored-Engine', engineUsed);
    res.send(processedBuffer);
});

function cleanupFiles(filePaths) {
    filePaths.forEach(fp => {
        try {
            if (fp && fs.existsSync(fp)) fs.unlinkSync(fp);
        } catch (e) {
            // ignore cleanup errors
        }
    });
}

const PORT = process.env.PORT || 8000;
app.listen(PORT, () => {
    console.log(`\n======================================================`);
    console.log(`🚀 PhotoRevive Full-Stack Neural Server Running!`);
    console.log(`📍 Web UI & API: http://localhost:${PORT}`);
    console.log(`🧠 Neural Engines: Real-ESRGAN x2/x4 (Local) + CodeFormer (Cloud)`);
    console.log(`======================================================\n`);
});
