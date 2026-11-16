# PhotoRevive

PhotoRevive is a photo-restoration web app with a static browser UI and a Node.js API that runs Real-ESRGAN ONNX models through Python/ONNX Runtime. GitHub Pages can serve the UI, but cannot run this backend or perform restoration. The included Render Blueprint is for deploying the complete app as one Docker web service so the UI and inference API share the same origin.

## Model files

The `models/` directory contains the Real-ESRGAN x2 and x4 ONNX weights used by local inference. The project owner has confirmed the rights to publish and use these project assets. Keep both files in the Docker build context; the container build will fail if either is missing.

## Run locally

Requirements: Node.js 22+, Python 3, and the packages in `requirements.txt`.

```powershell
npm ci
python -m pip install -r requirements.txt
node server.js
```

Open `http://localhost:8000`. The local Real-ESRGAN engine uses the two ONNX files in `models/`. The optional CodeFormer cloud engine requires an `HF_TOKEN` environment variable and depends on the availability and terms of the Hugging Face Space it calls.

## Deploy from GitHub

1. In Render, create a Blueprint from this GitHub repository and deploy `render.yaml`. The service uses a Standard instance for CPU inference; this is a paid service. Confirm the current price in Render before creating it. Add `HF_TOKEN` in the Render dashboard only if you intend to use the optional cloud engine. Never commit tokens.
2. Open the Render service URL. The `/api/health` endpoint reports whether both local models are present.

Render builds the app from the repository, so the model files must be available to its Docker build. Each model is below GitHub's 100 MB per-file limit, though GitHub warns on files over 50 MB.

## Upload behavior

Uploads are limited to 25 MB and are deleted from the server's temporary directory after processing. Hosted disks may be ephemeral; do not use `temp_uploads` for permanent storage.
