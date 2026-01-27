# Google Drive OAuth 2.0 Setup Guide

This guide explains how to generate the credentials needed for the United Album app to upload photos to your personal Google Drive.

## 1. Create a Google Cloud Project
1. Go to the [Google Cloud Console](https://console.cloud.google.com/).
2. Create a new project (e.g., "United Album").

## 2. Configure OAuth Consent Screen
1. Go to **APIs & Services > OAuth consent screen**.
2. Select **External** and click **Create**.
3. **App Information**: Enter a name (e.g., "United Album") and your email.
4. **Scopes**: Click **Add or Remove Scopes**, search for "Drive", and select `.../auth/drive.file`.
5. **Test Users**: Add your own Gmail address as a test user. **(Crucial step!)**

## 3. Create OAuth 2.0 Credentials
1. Go to **APIs & Services > Credentials**.
2. Click **+ Create Credentials > OAuth client ID**.
3. Select **Web application**.
4. **Authorized redirect URIs**: Add `https://developers.google.com/oauthplayground`.
5. Click **Create** and copy your **Client ID** and **Client Secret**.

## 4. Get a Refresh Token
1. Go to the [OAuth 2.0 Playground](https://developers.google.com/oauthplayground).
2. Click the ⚙️ (Settings) icon in the top right.
3. Check **"Use your own OAuth credentials"**.
4. Paste your **Client ID** and **Client Secret**, then click **Close**.
5. In **Step 1**, search for **Drive API v3** and select `https://www.googleapis.com/auth/drive.file`.
6. Click **Authorize APIs** and log in.
7. In **Step 2**, click **Exchange authorization code for tokens**.
8. Copy the **Refresh Token** from the JSON response.

## 5. Environment Variables
Add these values to your `.env.local` file. This file should **never** be committed to Git.

```env
GOOGLE_CLIENT_ID=your_client_id_here
GOOGLE_CLIENT_SECRET=your_client_secret_here
GOOGLE_REFRESH_TOKEN=your_refresh_token_here
GOOGLE_DRIVE_FOLDER_ID=your_destination_folder_id
```

> [!TIP]
> **Folder ID**: You can find this in the URL when you open your Google Drive folder (it's the long string after `/folders/`).
