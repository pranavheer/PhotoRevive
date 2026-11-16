# PhotoRevive

PhotoRevive is a photo-restoration web app with a static browser UI and a Node.js API that runs Real-ESRGAN ONNX models through Python/ONNX Runtime. GitHub Pages can serve the UI, but cannot run this backend or perform restoration. The included Render Blueprint is for deploying the complete app as one Docker web service so the UI and inference API share the same origin.

## Model files and deployment status

The current ONNX files in `models/` are intentionally excluded from Git: their source and redistribution terms could not be verified. Their filenames and successful local inference do not establish licensing. Obtain and document redistribution permission, or replace them with verified, appropriately licensed weights, before adding either file to a public repository or deploying the inference service. The Docker build requires both model files and will fail if they are missing.

As a result, publishing this repository does **not** make a live restoration service available. Do not enable a public demo until the model-rights check is complete and the backend has been deployed and tested. GitHub Pages alone cannot run the inference backend.

## Run locally

Requirements: Node.js 22+, Python 3, and the packages in `requirements.txt`.

```powershell
npm ci
python -m pip install -r requirements.txt
node server.js
```

Open `http://localhost:8000`. The local Real-ESRGAN engine uses the two ONNX files in `models/`. The optional CodeFormer cloud engine requires an `HF_TOKEN` environment variable and depends on the availability and terms of the Hugging Face Space it calls.

## Deploy from GitHub

1. Verify the source and redistribution terms for both ONNX model files, or replace them with appropriately licensed weights and update their filenames/code references.
2. Create or choose a GitHub repository and push this project, including both model files only after the rights check. Keep `.env`, `node_modules`, and `temp_uploads` out of the repository.
3. In Render, create a Blueprint from that GitHub repository and deploy `render.yaml`. The service uses a standard-sized instance for CPU inference; this is a paid Render service, not free GitHub Pages hosting. Add `HF_TOKEN` in the Render dashboard only if you intend to use the optional cloud engine. Never commit tokens.
4. Open the Render service URL. The `/api/health` endpoint reports whether both local models are present.

Render builds the app from the repository, so the model files must be available to its Docker build. Each current model is below GitHub's 100 MB per-file limit, but GitHub warns on files over 50 MB; consider Git LFS if appropriate for the selected deployment setup.

## Upload behavior

Uploads are limited to 25 MB and are deleted from the server's temporary directory after processing. Hosted disks may be ephemeral; do not use `temp_uploads` for permanent storage.
