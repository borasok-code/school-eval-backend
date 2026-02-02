import { google } from "googleapis";
import { Readable } from "node:stream";

const DRIVE_SCOPES = ["https://www.googleapis.com/auth/drive.file"];
const DEFAULT_DRIVE_FOLDER_ID = "1ZlVeuiyT5jk8E8peOwO06pAJT_qelnWZ";

const requireEnv = (name) => {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
};

const getDriveClient = () => {
  const clientEmail = requireEnv("GOOGLE_CLIENT_EMAIL");
  const privateKey = requireEnv("GOOGLE_PRIVATE_KEY").replace(/\\n/g, "\n");

  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: clientEmail,
      private_key: privateKey
    },
    scopes: DRIVE_SCOPES
  });

  return google.drive({ version: "v3", auth });
};

export const uploadToDrive = async ({ buffer, mimeType, filename, folderId }) => {
  if (!buffer || !filename) {
    throw new Error("Missing buffer or filename for upload.");
  }

  const targetFolderId = folderId || process.env.DRIVE_FOLDER_ID || DEFAULT_DRIVE_FOLDER_ID;
  const safeMimeType = mimeType || "application/octet-stream";
  const drive = getDriveClient();

  const response = await drive.files.create({
    requestBody: {
      name: filename,
      parents: [targetFolderId],
      mimeType: safeMimeType
    },
    media: {
      mimeType: safeMimeType,
      body: Readable.from(buffer)
    },
    fields: "id, webViewLink"
  });

  const file = response?.data;
  if (!file?.id) {
    throw new Error("Drive upload failed to return a file id.");
  }

  return { id: file.id, webViewLink: file.webViewLink || "" };
};
