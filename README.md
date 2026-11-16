# PhotoRevive

PhotoRevive is a photo-restoration web app with a static browser UI and a Node.js API that runs Real-ESRGAN ONNX models through Python/ONNX Runtime. GitHub Pages can serve the UI, but cannot run this backend or perform restoration. The Dockerfile can be deployed as one service to Google Cloud Run, which has a monthly request-based free tier subject to quotas and billing-account requirements. A Render Blueprint is also included as a paid alternative.

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

## Free-tier deployment with Google Cloud Run

Cloud Run's request-based free tier currently includes 180,000 vCPU-seconds, 360,000 GiB-seconds of memory, and 2 million requests per month (based on us-central1 pricing). This is a usage allowance, not an always-on guarantee or a promise of zero cost: you need a Google Cloud project with billing enabled, and usage beyond the allowance or other billable resources can be charged. Configure a billing budget/alert before deployment; alerts notify you but do not cap spending.

1. Install the [Google Cloud CLI](https://cloud.google.com/sdk/docs/install), create or select a Google Cloud project, and enable billing for it.
2. In PowerShell, authenticate and select your project:

   ```powershell
   gcloud auth login
   gcloud config set project YOUR_PROJECT_ID
   gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com
   ```

3. From the project folder, deploy with scale-to-zero and one-at-a-time processing:

   ```powershell
   cd C:\PhotoRevive
   gcloud run deploy photorevive --source . --region us-central1 --allow-unauthenticated --memory 4Gi --cpu 2 --max 1 --min 0 --concurrency 1 --timeout 300
   ```

   Confirm the public-access and billing prompts. The command builds the included Dockerfile, which contains both model files.
4. Open the `Service URL` printed by the command. Verify that `<Service URL>/api/health` returns `status: "ok"` and both models as `ready`.

The service scales to zero while idle, so the first request after inactivity may take longer. `--max 1` and `--min 0` help limit compute usage but do not guarantee that the bill will be zero. Check current [Cloud Run pricing and free-tier quotas](https://cloud.google.com/run/pricing) before deploying.

## Paid alternative: Render

In Render, create a Blueprint from this GitHub repository and deploy `render.yaml`. It uses a Standard instance; confirm the current price in Render before creating it. Add `HF_TOKEN` in the Render dashboard only if you intend to use the optional cloud engine. Never commit tokens. Open the Render service URL and verify `/api/health`.

## Upload behavior

Uploads are limited to 25 MB and are deleted from the server's temporary directory after processing. Hosted disks may be ephemeral; do not use `temp_uploads` for permanent storage.
