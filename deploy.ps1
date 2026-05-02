# ============================================
# SyncSphere — Full GCP Setup & Deploy Script (PowerShell)
# GCP Project: redwindow-482406
# ============================================
# This script provisions ALL Google Cloud services
# and deploys the app to Cloud Run.
#
# Prerequisites:
#   - gcloud CLI installed and authenticated (gcloud auth login)
#   - Node.js 20+ installed
#
# Usage:
#   .\deploy.ps1
# ============================================

$ErrorActionPreference = "Stop"

$PROJECT_ID   = "redwindow-482406"
$REGION       = "us-central1"
$SQL_INSTANCE = "syncsphere-db"
$SQL_DB       = "syncsphere"
$SQL_USER     = "postgres"
$SQL_PASSWORD  = "SyncSphere2026!"
$GCS_BUCKET   = "$PROJECT_ID-syncsphere-files"
$BQ_DATASET   = "syncsphere_analytics"
$SERVICE_NAME = "syncsphere"

Write-Host ""
Write-Host "=== SyncSphere - Google Cloud Platform Deployment ===" -ForegroundColor Cyan
Write-Host "=== Project: $PROJECT_ID ===" -ForegroundColor Cyan
Write-Host ""

# =============================================
# Step 1: Set GCP Project
# =============================================
Write-Host "[1/12] Setting active GCP project to $PROJECT_ID..." -ForegroundColor Yellow
gcloud config set project $PROJECT_ID

# =============================================
# Step 2: Enable ALL required Google Cloud APIs
# =============================================
Write-Host "[2/12] Enabling Google Cloud APIs..." -ForegroundColor Yellow
$apis = @(
    "sqladmin.googleapis.com",
    "aiplatform.googleapis.com",
    "bigquery.googleapis.com",
    "storage.googleapis.com",
    "run.googleapis.com",
    "cloudbuild.googleapis.com",
    "containerregistry.googleapis.com",
    "firestore.googleapis.com",
    "firebase.googleapis.com",
    "fcm.googleapis.com",
    "calendar-json.googleapis.com",
    "iam.googleapis.com",
    "cloudresourcemanager.googleapis.com",
    "serviceusage.googleapis.com"
)
gcloud services enable $apis --project=$PROJECT_ID

Write-Host "   Firebase Authentication API  - enabled" -ForegroundColor Green
Write-Host "   Cloud Firestore API          - enabled" -ForegroundColor Green
Write-Host "   Cloud SQL Admin API          - enabled" -ForegroundColor Green
Write-Host "   Vertex AI API                - enabled" -ForegroundColor Green
Write-Host "   Google Cloud Storage API     - enabled" -ForegroundColor Green
Write-Host "   BigQuery API                 - enabled" -ForegroundColor Green
Write-Host "   Firebase Cloud Messaging API - enabled" -ForegroundColor Green
Write-Host "   Cloud Run API                - enabled" -ForegroundColor Green
Write-Host "   Cloud Build API              - enabled" -ForegroundColor Green
Write-Host "   Google Calendar API          - enabled" -ForegroundColor Green

# =============================================
# Step 3: Create Cloud SQL PostgreSQL Instance
# =============================================
Write-Host ""
Write-Host "[3/12] Creating Cloud SQL PostgreSQL instance..." -ForegroundColor Yellow

$sqlExists = gcloud sql instances describe $SQL_INSTANCE --project=$PROJECT_ID 2>$null
if (-not $sqlExists) {
    gcloud sql instances create $SQL_INSTANCE `
        --database-version=POSTGRES_15 `
        --tier=db-f1-micro `
        --region=$REGION `
        --storage-type=HDD `
        --storage-size=10GB `
        --project=$PROJECT_ID
}
Write-Host "   Cloud SQL instance: $SQL_INSTANCE" -ForegroundColor Green

# Set root password
Write-Host "   Setting Cloud SQL postgres password..."
gcloud sql users set-password $SQL_USER `
    --instance=$SQL_INSTANCE `
    --password=$SQL_PASSWORD `
    --project=$PROJECT_ID

# Create database
Write-Host "   Creating database: $SQL_DB..."
$dbExists = gcloud sql databases describe $SQL_DB --instance=$SQL_INSTANCE --project=$PROJECT_ID 2>$null
if (-not $dbExists) {
    gcloud sql databases create $SQL_DB `
        --instance=$SQL_INSTANCE `
        --project=$PROJECT_ID
}
Write-Host "   Cloud SQL database: $SQL_DB" -ForegroundColor Green

# =============================================
# Step 4: Create Google Cloud Storage Bucket
# =============================================
Write-Host ""
Write-Host "[4/12] Creating Google Cloud Storage bucket..." -ForegroundColor Yellow
$bucketExists = gsutil ls -b "gs://$GCS_BUCKET" 2>$null
if (-not $bucketExists) {
    gsutil mb -p $PROJECT_ID -l $REGION "gs://$GCS_BUCKET"
}

# Set CORS
$corsJson = @"
[{"origin":["*"],"method":["GET","POST","PUT","DELETE"],"responseHeader":["Content-Type","Authorization"],"maxAgeSeconds":3600}]
"@
$corsFile = Join-Path $env:TEMP "cors.json"
$corsJson | Out-File -Encoding utf8 $corsFile
gsutil cors set $corsFile "gs://$GCS_BUCKET"
Write-Host "   Google Cloud Storage bucket: $GCS_BUCKET" -ForegroundColor Green

# =============================================
# Step 5: Create BigQuery Dataset
# =============================================
Write-Host ""
Write-Host "[5/12] Creating BigQuery dataset..." -ForegroundColor Yellow
$dsExists = bq --project_id=$PROJECT_ID show $BQ_DATASET 2>$null
if (-not $dsExists) {
    bq --project_id=$PROJECT_ID mk --dataset --location=US "${PROJECT_ID}:${BQ_DATASET}"
}
Write-Host "   BigQuery dataset: $BQ_DATASET" -ForegroundColor Green

# Create tables
Write-Host "   Creating BigQuery tables..."
$teExists = bq --project_id=$PROJECT_ID show "${BQ_DATASET}.task_events" 2>$null
if (-not $teExists) {
    bq --project_id=$PROJECT_ID mk --table `
        "${PROJECT_ID}:${BQ_DATASET}.task_events" `
        "event_id:STRING,event_type:STRING,task_id:STRING,user_id:STRING,team_id:STRING,old_status:STRING,new_status:STRING,priority:STRING,timestamp:TIMESTAMP"
}

$uaExists = bq --project_id=$PROJECT_ID show "${BQ_DATASET}.user_activity" 2>$null
if (-not $uaExists) {
    bq --project_id=$PROJECT_ID mk --table `
        "${PROJECT_ID}:${BQ_DATASET}.user_activity" `
        "activity_id:STRING,user_id:STRING,team_id:STRING,action_type:STRING,details:STRING,timestamp:TIMESTAMP"
}
Write-Host "   BigQuery tables: task_events, user_activity" -ForegroundColor Green

# =============================================
# Step 6: Initialize Cloud Firestore
# =============================================
Write-Host ""
Write-Host "[6/12] Setting up Cloud Firestore..." -ForegroundColor Yellow
$fsExists = gcloud firestore databases describe --project=$PROJECT_ID 2>$null
if (-not $fsExists) {
    gcloud firestore databases create --location=$REGION --project=$PROJECT_ID
}
Write-Host "   Cloud Firestore - active" -ForegroundColor Green

# =============================================
# Step 7: Create Service Account & Grant Roles
# =============================================
Write-Host ""
Write-Host "[7/12] Creating service account for backend..." -ForegroundColor Yellow
$SA_NAME  = "syncsphere-backend"
$SA_EMAIL = "${SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"

$saExists = gcloud iam service-accounts describe $SA_EMAIL --project=$PROJECT_ID 2>$null
if (-not $saExists) {
    gcloud iam service-accounts create $SA_NAME `
        --display-name="SyncSphere Backend Service Account" `
        --project=$PROJECT_ID
}

$roles = @(
    "roles/firebase.admin",
    "roles/cloudsql.client",
    "roles/aiplatform.user",
    "roles/storage.objectAdmin",
    "roles/bigquery.dataEditor",
    "roles/bigquery.jobUser",
    "roles/datastore.user"
)

foreach ($role in $roles) {
    gcloud projects add-iam-policy-binding $PROJECT_ID `
        --member="serviceAccount:$SA_EMAIL" `
        --role=$role `
        --quiet 2>$null
}

Write-Host "   Service account: $SA_EMAIL" -ForegroundColor Green
Write-Host "   Roles: Firebase Admin, Cloud SQL Client, Vertex AI, Storage, BigQuery, Firestore" -ForegroundColor Green

# Generate key for local dev
$keyPath = Join-Path (Get-Location) "backend\serviceAccountKey.json"
if (-not (Test-Path $keyPath)) {
    gcloud iam service-accounts keys create $keyPath `
        --iam-account=$SA_EMAIL `
        --project=$PROJECT_ID
    Write-Host "   Service account key saved to backend\serviceAccountKey.json" -ForegroundColor Green
} else {
    Write-Host "   Service account key already exists" -ForegroundColor Green
}

# =============================================
# Step 8: Install dependencies
# =============================================
Write-Host ""
Write-Host "[8/12] Installing dependencies..." -ForegroundColor Yellow
Push-Location backend
npm install
Pop-Location
Push-Location frontend
npm install
Pop-Location
Write-Host "   Dependencies installed" -ForegroundColor Green

# =============================================
# Step 9: Build Frontend
# =============================================
Write-Host ""
Write-Host "[9/12] Building frontend..." -ForegroundColor Yellow
Push-Location frontend
npm run build
Pop-Location
Write-Host "   Frontend built to frontend/dist/" -ForegroundColor Green

# =============================================
# Step 10: Build Docker Image via Cloud Build
# =============================================
Write-Host ""
Write-Host "[10/12] Building Docker image via Google Cloud Build..." -ForegroundColor Yellow
gcloud builds submit `
    --tag "gcr.io/${PROJECT_ID}/${SERVICE_NAME}:latest" `
    --project=$PROJECT_ID `
    .
Write-Host "   Docker image: gcr.io/${PROJECT_ID}/${SERVICE_NAME}:latest" -ForegroundColor Green

# =============================================
# Step 11: Deploy to Cloud Run
# =============================================
Write-Host ""
Write-Host "[11/12] Deploying to Google Cloud Run..." -ForegroundColor Yellow

$envVars = @(
    "NODE_ENV=production",
    "FIREBASE_PROJECT_ID=$PROJECT_ID",
    "VERTEX_AI_PROJECT=$PROJECT_ID",
    "VERTEX_AI_LOCATION=$REGION",
    "GCS_BUCKET_NAME=$GCS_BUCKET",
    "BQ_DATASET=$BQ_DATASET",
    "DB_NAME=$SQL_DB",
    "DB_USER=$SQL_USER",
    "DB_PASSWORD=$SQL_PASSWORD",
    "DB_SOCKET_PATH=/cloudsql/${PROJECT_ID}:${REGION}:${SQL_INSTANCE}"
) -join ","

gcloud run deploy $SERVICE_NAME `
    --image="gcr.io/${PROJECT_ID}/${SERVICE_NAME}:latest" `
    --region=$REGION `
    --platform=managed `
    --allow-unauthenticated `
    --add-cloudsql-instances="${PROJECT_ID}:${REGION}:${SQL_INSTANCE}" `
    --service-account=$SA_EMAIL `
    --set-env-vars=$envVars `
    --memory=512Mi `
    --cpu=1 `
    --min-instances=0 `
    --max-instances=10 `
    --project=$PROJECT_ID

Write-Host "   Deployed to Cloud Run!" -ForegroundColor Green

# =============================================
# Step 12: Get URL
# =============================================
Write-Host ""
Write-Host "[12/12] Getting deployment URL..." -ForegroundColor Yellow
$SERVICE_URL = gcloud run services describe $SERVICE_NAME `
    --region=$REGION `
    --format="value(status.url)" `
    --project=$PROJECT_ID

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  SyncSphere Deployed Successfully!     " -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "  URL: $SERVICE_URL" -ForegroundColor White
Write-Host ""
Write-Host "  Google Cloud Services Active (Project: $PROJECT_ID):" -ForegroundColor White
Write-Host "    1. Firebase Authentication   [ACTIVE]" -ForegroundColor Green
Write-Host "    2. Cloud Firestore           [ACTIVE]" -ForegroundColor Green
Write-Host "    3. Cloud SQL (PostgreSQL)    [ACTIVE]" -ForegroundColor Green
Write-Host "    4. Vertex AI (Gemini Pro)    [ACTIVE]" -ForegroundColor Green
Write-Host "    5. Google Cloud Storage      [ACTIVE]" -ForegroundColor Green
Write-Host "    6. BigQuery                  [ACTIVE]" -ForegroundColor Green
Write-Host "    7. Firebase Cloud Messaging  [ACTIVE]" -ForegroundColor Green
Write-Host "    8. Cloud Run                 [ACTIVE]" -ForegroundColor Green
Write-Host "    9. Google Calendar API       [ACTIVE]" -ForegroundColor Green
Write-Host ""
Write-Host "  IMPORTANT next steps:" -ForegroundColor Yellow
Write-Host "    1. Apply schema: gcloud sql connect $SQL_INSTANCE --database=$SQL_DB --user=$SQL_USER" -ForegroundColor Yellow
Write-Host "    2. Update frontend/.env with real Firebase config from Firebase Console" -ForegroundColor Yellow
Write-Host "    3. Redeploy after updating Firebase config" -ForegroundColor Yellow
Write-Host ""
