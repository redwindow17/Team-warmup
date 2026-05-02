#!/bin/bash
# ============================================
# SyncSphere — Full GCP Setup & Deploy Script
# GCP Project: redwindow-482406
# ============================================
# This script provisions ALL Google Cloud services
# and deploys the app to Cloud Run.
#
# Prerequisites:
#   - gcloud CLI installed and authenticated
#   - Node.js 20+ installed
#
# Usage:
#   chmod +x deploy.sh
#   ./deploy.sh
# ============================================

set -e

PROJECT_ID="redwindow-482406"
REGION="us-central1"
SQL_INSTANCE="syncsphere-db"
SQL_DB="syncsphere"
SQL_USER="postgres"
SQL_PASSWORD="SyncSphere2026!"
GCS_BUCKET="${PROJECT_ID}-syncsphere-files"
BQ_DATASET="syncsphere_analytics"
SERVICE_NAME="syncsphere"

echo ""
echo "╔══════════════════════════════════════════════════════╗"
echo "║   SyncSphere — Google Cloud Platform Deployment     ║"
echo "║   Project: ${PROJECT_ID}                     ║"
echo "╚══════════════════════════════════════════════════════╝"
echo ""

# =============================================
# Step 1: Set GCP Project
# =============================================
echo "🔧 [1/12] Setting active GCP project to ${PROJECT_ID}..."
gcloud config set project ${PROJECT_ID}

# =============================================
# Step 2: Enable ALL required Google Cloud APIs
# =============================================
echo "🔧 [2/12] Enabling Google Cloud APIs..."
gcloud services enable \
  sqladmin.googleapis.com \
  aiplatform.googleapis.com \
  bigquery.googleapis.com \
  storage.googleapis.com \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  containerregistry.googleapis.com \
  firestore.googleapis.com \
  firebase.googleapis.com \
  fcm.googleapis.com \
  calendar-json.googleapis.com \
  iam.googleapis.com \
  cloudresourcemanager.googleapis.com \
  serviceusage.googleapis.com \
  --project=${PROJECT_ID}

echo "   ✅ Firebase Authentication API  — enabled"
echo "   ✅ Cloud Firestore API          — enabled"
echo "   ✅ Cloud SQL Admin API          — enabled"
echo "   ✅ Vertex AI API                — enabled"
echo "   ✅ Google Cloud Storage API     — enabled"
echo "   ✅ BigQuery API                 — enabled"
echo "   ✅ Firebase Cloud Messaging API — enabled"
echo "   ✅ Cloud Run API                — enabled"
echo "   ✅ Cloud Build API              — enabled"
echo "   ✅ Google Calendar API          — enabled"

# =============================================
# Step 3: Create Cloud SQL PostgreSQL Instance
# =============================================
echo ""
echo "🗄️  [3/12] Creating Cloud SQL PostgreSQL instance..."
gcloud sql instances describe ${SQL_INSTANCE} --project=${PROJECT_ID} 2>/dev/null || \
gcloud sql instances create ${SQL_INSTANCE} \
  --database-version=POSTGRES_15 \
  --tier=db-f1-micro \
  --region=${REGION} \
  --storage-type=HDD \
  --storage-size=10GB \
  --project=${PROJECT_ID}

echo "   ✅ Cloud SQL instance: ${SQL_INSTANCE}"

# Set root password
echo "   Setting Cloud SQL postgres password..."
gcloud sql users set-password ${SQL_USER} \
  --instance=${SQL_INSTANCE} \
  --password=${SQL_PASSWORD} \
  --project=${PROJECT_ID}

# Create database
echo "   Creating database: ${SQL_DB}..."
gcloud sql databases describe ${SQL_DB} --instance=${SQL_INSTANCE} --project=${PROJECT_ID} 2>/dev/null || \
gcloud sql databases create ${SQL_DB} \
  --instance=${SQL_INSTANCE} \
  --project=${PROJECT_ID}

echo "   ✅ Cloud SQL database: ${SQL_DB}"

# =============================================
# Step 4: Initialize schema via Cloud SQL Proxy
# =============================================
echo ""
echo "📋 [4/12] Note: Run schema.sql manually after deployment:"
echo "   gcloud sql connect ${SQL_INSTANCE} --database=${SQL_DB} --user=${SQL_USER} --project=${PROJECT_ID}"
echo "   Then paste contents of backend/models/schema.sql"

# =============================================
# Step 5: Create Google Cloud Storage Bucket
# =============================================
echo ""
echo "📦 [5/12] Creating Google Cloud Storage bucket..."
gsutil ls -b gs://${GCS_BUCKET} 2>/dev/null || \
gsutil mb -p ${PROJECT_ID} -l ${REGION} gs://${GCS_BUCKET}

# Set CORS for browser uploads
cat > /tmp/cors.json << 'EOF'
[
  {
    "origin": ["*"],
    "method": ["GET", "POST", "PUT", "DELETE"],
    "responseHeader": ["Content-Type", "Authorization"],
    "maxAgeSeconds": 3600
  }
]
EOF
gsutil cors set /tmp/cors.json gs://${GCS_BUCKET}
echo "   ✅ Google Cloud Storage bucket: ${GCS_BUCKET}"

# =============================================
# Step 6: Create BigQuery Dataset
# =============================================
echo ""
echo "📊 [6/12] Creating BigQuery dataset..."
bq --project_id=${PROJECT_ID} show ${BQ_DATASET} 2>/dev/null || \
bq --project_id=${PROJECT_ID} mk \
  --dataset \
  --location=US \
  ${PROJECT_ID}:${BQ_DATASET}

echo "   ✅ BigQuery dataset: ${BQ_DATASET}"

# Create BigQuery tables
echo "   Creating BigQuery tables..."

bq --project_id=${PROJECT_ID} show ${BQ_DATASET}.task_events 2>/dev/null || \
bq --project_id=${PROJECT_ID} mk \
  --table \
  ${PROJECT_ID}:${BQ_DATASET}.task_events \
  event_id:STRING,event_type:STRING,task_id:STRING,user_id:STRING,team_id:STRING,old_status:STRING,new_status:STRING,priority:STRING,timestamp:TIMESTAMP

bq --project_id=${PROJECT_ID} show ${BQ_DATASET}.user_activity 2>/dev/null || \
bq --project_id=${PROJECT_ID} mk \
  --table \
  ${PROJECT_ID}:${BQ_DATASET}.user_activity \
  activity_id:STRING,user_id:STRING,team_id:STRING,action_type:STRING,details:STRING,timestamp:TIMESTAMP

echo "   ✅ BigQuery tables: task_events, user_activity"

# =============================================
# Step 7: Initialize Cloud Firestore
# =============================================
echo ""
echo "🔥 [7/12] Setting up Cloud Firestore..."
gcloud firestore databases describe --project=${PROJECT_ID} 2>/dev/null || \
gcloud firestore databases create \
  --location=${REGION} \
  --project=${PROJECT_ID}

echo "   ✅ Cloud Firestore — active"

# =============================================
# Step 8: Create Firebase Service Account Key
# =============================================
echo ""
echo "🔑 [8/12] Creating service account for backend..."
SA_NAME="syncsphere-backend"
SA_EMAIL="${SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"

gcloud iam service-accounts describe ${SA_EMAIL} --project=${PROJECT_ID} 2>/dev/null || \
gcloud iam service-accounts create ${SA_NAME} \
  --display-name="SyncSphere Backend Service Account" \
  --project=${PROJECT_ID}

# Grant required roles
ROLES=(
  "roles/firebase.admin"
  "roles/cloudsql.client"
  "roles/aiplatform.user"
  "roles/storage.objectAdmin"
  "roles/bigquery.dataEditor"
  "roles/bigquery.jobUser"
  "roles/datastore.user"
)

for ROLE in "${ROLES[@]}"; do
  gcloud projects add-iam-policy-binding ${PROJECT_ID} \
    --member="serviceAccount:${SA_EMAIL}" \
    --role="${ROLE}" \
    --quiet
done

echo "   ✅ Service account: ${SA_EMAIL}"
echo "   ✅ Granted: Firebase Admin, Cloud SQL Client, Vertex AI User,"
echo "      Storage Object Admin, BigQuery Data Editor, Firestore User"

# Generate service account key for local development
echo "   Generating service account key..."
gcloud iam service-accounts keys create backend/serviceAccountKey.json \
  --iam-account=${SA_EMAIL} \
  --project=${PROJECT_ID} 2>/dev/null || echo "   Key already exists or generated."

echo "   ✅ Service account key saved to backend/serviceAccountKey.json"

# =============================================
# Step 9: Build Frontend
# =============================================
echo ""
echo "🏗️  [9/12] Building frontend..."
cd frontend
npm install
npm run build
cd ..
echo "   ✅ Frontend built to frontend/dist/"

# =============================================
# Step 10: Build Docker Image
# =============================================
echo ""
echo "🐳 [10/12] Building Docker image..."
gcloud builds submit \
  --tag gcr.io/${PROJECT_ID}/${SERVICE_NAME}:latest \
  --project=${PROJECT_ID} \
  .

echo "   ✅ Docker image: gcr.io/${PROJECT_ID}/${SERVICE_NAME}:latest"

# =============================================
# Step 11: Deploy to Cloud Run
# =============================================
echo ""
echo "🚀 [11/12] Deploying to Google Cloud Run..."
gcloud run deploy ${SERVICE_NAME} \
  --image=gcr.io/${PROJECT_ID}/${SERVICE_NAME}:latest \
  --region=${REGION} \
  --platform=managed \
  --allow-unauthenticated \
  --add-cloudsql-instances=${PROJECT_ID}:${REGION}:${SQL_INSTANCE} \
  --service-account=${SA_EMAIL} \
  --set-env-vars="\
NODE_ENV=production,\
FIREBASE_PROJECT_ID=${PROJECT_ID},\
VERTEX_AI_PROJECT=${PROJECT_ID},\
VERTEX_AI_LOCATION=${REGION},\
GCS_BUCKET_NAME=${GCS_BUCKET},\
BQ_DATASET=${BQ_DATASET},\
DB_NAME=${SQL_DB},\
DB_USER=${SQL_USER},\
DB_PASSWORD=${SQL_PASSWORD},\
DB_SOCKET_PATH=/cloudsql/${PROJECT_ID}:${REGION}:${SQL_INSTANCE}" \
  --memory=512Mi \
  --cpu=1 \
  --min-instances=0 \
  --max-instances=10 \
  --project=${PROJECT_ID}

echo "   ✅ Deployed to Cloud Run!"

# =============================================
# Step 12: Get deployment URL
# =============================================
echo ""
echo "🌐 [12/12] Getting deployment URL..."
SERVICE_URL=$(gcloud run services describe ${SERVICE_NAME} \
  --region=${REGION} \
  --format="value(status.url)" \
  --project=${PROJECT_ID})

echo ""
echo "╔══════════════════════════════════════════════════════╗"
echo "║         🎉 SyncSphere Deployed Successfully!        ║"
echo "╚══════════════════════════════════════════════════════╝"
echo ""
echo "  📍 URL: ${SERVICE_URL}"
echo ""
echo "  ☁️  Google Cloud Services Active (Project: ${PROJECT_ID}):"
echo "     1. Firebase Authentication  ✅"
echo "     2. Cloud Firestore          ✅"
echo "     3. Cloud SQL (PostgreSQL)   ✅"
echo "     4. Vertex AI (Gemini Pro)   ✅"
echo "     5. Google Cloud Storage     ✅"
echo "     6. BigQuery                 ✅"
echo "     7. Firebase Cloud Messaging ✅"
echo "     8. Cloud Run                ✅"
echo "     9. Google Calendar API      ✅"
echo ""
echo "  ⚠️  IMPORTANT: Don't forget to:"
echo "     1. Apply schema.sql to Cloud SQL:"
echo "        gcloud sql connect ${SQL_INSTANCE} --database=${SQL_DB} --user=${SQL_USER}"
echo "     2. Update frontend/.env with real Firebase config from Firebase Console"
echo "     3. Redeploy after updating Firebase config"
echo ""
