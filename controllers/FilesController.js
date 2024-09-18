import express from 'express';
import { ObjectId } from 'mongodb';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import mime from 'mime-types';
import redisClient from '../utils/redis.js';
import dbClient from '../utils/db.js';

const acceptedTypes = ['folder', 'file', 'image'];

class FilesController {
    // Upload a file or create a folder
    static async postUpload(req, res) {
        try {
            const token = req.header('x-token');
            if (!token) return res.status(401).json({ error: 'Unauthorized' });

            const key = `auth_${token}`;
            const userId = await redisClient.get(key);
            if (!userId) return res.status(401).json({ error: 'Unauthorized' });

            const user = await dbClient.db.collection('users').findOne({ _id: new ObjectId(userId) });
            if (!user) return res.status(401).json({ error: 'Unauthorized' });

            let { name, type, parentId = '0', isPublic = false, data } = req.body;
            if (!name) return res.status(400).json({ error: 'Missing name' });
            if (!type || !acceptedTypes.includes(type)) return res.status(400).json({ error: 'Missing type' });
            if (type !== 'folder' && !data) return res.status(400).json({ error: 'Missing data' });

            if (parentId !== '0') {
                const parentFolder = await dbClient.db.collection('files').findOne({ _id: new ObjectId(parentId) });
                if (!parentFolder) return res.status(400).json({ error: 'Parent not found' });
                if (parentFolder.type !== 'folder') return res.status(400).json({ error: 'Parent is not a folder' });
            }

            let fileDoc;
            if (type !== 'folder') {
                const localPath = await FilesController.saveFileLocally(data);
                if (!localPath) return res.status(500).json({ error: 'Failed to save file' });

                fileDoc = {
                    userId: ObjectId(userId),
                    name,
                    type,
                    isPublic,
                    parentId,
                    localPath,
                };
            } else {
                fileDoc = {
                    userId: ObjectId(userId),
                    name,
                    type,
                    isPublic,
                    parentId,
                };
            }

            await dbClient.db.collection('files').insertOne(fileDoc);
            return res.status(201).json(fileDoc);
        } catch (error) {
            console.error('Error in postUpload:', error);
            return res.status(500).json({ error: 'Internal Server Error' });
        }
    }

    // Save file data locally
    static async saveFileLocally(data) {
        const LOCALFOLDERNAME = process.env.FOLDER_PATH || '/tmp/files_manager';
        const UUID = uuidv4();
        const localPath = path.join(LOCALFOLDERNAME, UUID);

        try {
            await fs.promises.access(LOCALFOLDERNAME);
        } catch (error) {
            await fs.promises.mkdir(LOCALFOLDERNAME, { recursive: true });
        }

        try {
            await fs.promises.writeFile(localPath, Buffer.from(data, 'base64'));
            return localPath;
        } catch (error) {
            console.error('Failed to save file:', error);
            return false;
        }
    }

    // Retrieve file metadata
    static async getShow(req, res) {
        try {
            const token = req.header('x-token');
            if (!token) return res.status(401).json({ error: 'Unauthorized' });

            const userId = await redisClient.get(`auth_${token}`);
            if (!userId) return res.status(401).json({ error: 'Unauthorized' });

            const { id } = req.params;
            const file = await dbClient.db.collection('files').findOne({ _id: new ObjectId(id), userId: new ObjectId(userId) });
            if (!file) return res.status(404).json({ error: 'Not found' });

            return res.status(200).json(file);
        } catch (error) {
            console.error('Error in getShow:', error);
            return res.status(500).json({ error: 'Internal Server Error' });
        }
    }

    // List files in a directory
    static async getIndex(req, res) {
        try {
            const token = req.header('x-token');
            if (!token) return res.status(401).json({ error: 'Unauthorized' });

            const userId = await redisClient.get(`auth_${token}`);
            if (!userId) return res.status(401).json({ error: 'Unauthorized' });

            const parentId = req.query.parentId || '0';
            const page = parseInt(req.query.page, 10) || 0;
            const pageSize = 20;

            const files = await dbClient.db.collection('files').find({
                userId: new ObjectId(userId),
                parentId: parentId === '0' ? '0' : new ObjectId(parentId),
            })
            .skip(page * pageSize)
            .limit(pageSize)
            .toArray();

            return res.status(200).json(files);
        } catch (error) {
            console.error('Error in getIndex:', error);
            return res.status(500).json({ error: 'Internal Server Error' });
        }
    }

    // Publish a file (make it public)
    static async putPublish(req, res) {
        try {
            const token = req.header('x-token');
            if (!token) return res.status(401).json({ error: 'Unauthorized' });

            const userId = await redisClient.get(`auth_${token}`);
            if (!userId) return res.status(401).json({ error: 'Unauthorized' });

            const { id } = req.params;
            const file = await dbClient.db.collection('files').findOne({ _id: new ObjectId(id), userId: new ObjectId(userId) });
            if (!file) return res.status(404).json({ error: 'Not found' });

            await dbClient.db.collection('files').updateOne({ _id: new ObjectId(id) }, { $set: { isPublic: true } });
            return res.status(200).json({ ...file, isPublic: true });
        } catch (error) {
            console.error('Error in putPublish:', error);
            return res.status(500).json({ error: 'Internal Server Error' });
        }
    }

    // Unpublish a file (make it private)
    static async putUnpublish(req, res) {
        try {
            const token = req.header('x-token');
            if (!token) return res.status(401).json({ error: 'Unauthorized' });

            const userId = await redisClient.get(`auth_${token}`);
            if (!userId) return res.status(401).json({ error: 'Unauthorized' });

            const { id } = req.params;
            const file = await dbClient.db.collection('files').findOne({ _id: new ObjectId(id), userId: new ObjectId(userId) });
            if (!file) return res.status(404).json({ error: 'Not found' });

            await dbClient.db.collection('files').updateOne({ _id: new ObjectId(id) }, { $set: { isPublic: false } });
            return res.status(200).json({ ...file, isPublic: false });
        } catch (error) {
            console.error('Error in putUnpublish:', error);
            return res.status(500).json({ error: 'Internal Server Error' });
        }
    }

    // Retrieve and serve a file
    static async getFile(req, res) {
        try {
            const { id } = req.params;
            const file = await dbClient.db.collection('files').findOne({ _id: new ObjectId(id) });
            if (!file) return res.status(404).json({ error: 'File not found' });

            if (!file.isPublic && (!req.user || req.user.id !== file.userId.toString())) {
                return res.status(404).json({ error: 'File not found' });
            }

            if (file.type === 'folder') return res.status(400).json({ error: "A folder doesn't have content" });

            if (!file.localPath) return res.status(404).json({ error: 'File not found' });

            const mimeType = mime.lookup(file.name);
            res.setHeader('Content-Type', mimeType);

            const data = fs.readFileSync(file.localPath);
            return res.status(200).send(data);
        } catch (error) {
            console.error('Error in getFile:', error);
            return res.status(500).json({ error: 'Internal Server Error' });
        }
    }
}

export default FilesController;
