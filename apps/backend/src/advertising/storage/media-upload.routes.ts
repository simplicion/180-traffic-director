import { Router, Request, Response } from 'express';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const router = Router();
const uploadDir = path.resolve(process.cwd(), 'uploads');
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || '').slice(0, 12);
    const id = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}`;
    cb(null, `${id}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }
});

function buildPublicUrl(req: Request, filename: string): string {
  const configured = (process.env.PUBLIC_EDGE_URL || process.env.NEXT_PUBLIC_API_URL || '').trim().replace(/\/+$/, '');
  if (configured) return `${configured}/uploads/${filename}`;
  const proto = (req.headers['x-forwarded-proto'] as string) || req.protocol || 'http';
  const host = (req.headers['x-forwarded-host'] as string) || req.get('host') || 'localhost:4005';
  return `${proto}://${host}/uploads/${filename}`;
}

router.get('/', (req: Request, res: Response) => {
  try {
    const files = fs.readdirSync(uploadDir).map((name) => {
      const stat = fs.statSync(path.join(uploadDir, name));
      return {
        id: name,
        docId: name,
        name,
        url: buildPublicUrl(req, name),
        size: stat.size,
        createdAt: stat.birthtime.toISOString()
      };
    });
    res.json({ success: true, data: files, files });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/upload', upload.single('file'), (req: Request, res: Response) => {
  const file = (req as any).file;
  if (!file) {
    return res.status(400).json({ success: false, error: 'No file uploaded' });
  }
  const url = buildPublicUrl(req, file.filename);
  return res.status(201).json({
    success: true,
    url,
    fileUrl: url,
    fileName: file.originalname,
    data: {
      id: file.filename,
      docId: file.filename,
      url,
      fileUrl: url,
      name: file.originalname,
      mimeType: file.mimetype,
      size: file.size
    }
  });
});

router.delete('/:id', (req: Request, res: Response) => {
  const safeName = path.basename(String(req.params.id || ''));
  const target = path.join(uploadDir, safeName);
  if (fs.existsSync(target)) {
    fs.unlinkSync(target);
  }
  res.json({ success: true });
});

export { uploadDir };
export default router;
