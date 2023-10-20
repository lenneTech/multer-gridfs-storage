import { ObjectId } from "mongodb";
export interface GridFile {
    _id: ObjectId;
    filename: string;
    metadata: Document;
    contentType: string;
    chunkSize: number;
    bucketName: string;
    uploadDate: Date;
    md5: string;
    size: number;
    length: number;
}
