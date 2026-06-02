import { StorageClient } from "@ido_kawaz/storage-client";
import { Readable } from "stream";
import { SubtitleStream } from "../dal/media/model";

const streamToString = (stream: Readable): Promise<string> =>
    new Promise((resolve, reject) => {
        const chunks: Buffer[] = [];
        stream.on('data', (chunk: Buffer | string) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
        stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
        stream.on('error', reject);
    });

const stripSubtitleSets = (mpd: string): string =>
    mpd.replace(/\t\t<AdaptationSet[^>]+contentType="text"[\s\S]*?<\/AdaptationSet>\n/g, '');

const injectSubtitleSets = (stripped: string, streams: SubtitleStream[]): string => {
    const enabled = streams.filter(s => s.enabled !== false);
    if (!enabled.length) return stripped;
    const maxId = Math.max(-1, ...[...stripped.matchAll(/id="(\d+)"/g)].map(m => parseInt(m[1])));
    const sets = enabled.map((s, i) => [
        `\t\t<AdaptationSet id="${maxId + 1 + i}" contentType="text" mimeType="text/vtt" lang="${s.language}">`,
        `\t\t\t<Label>${s.title}</Label>`,
        `\t\t\t<Role schemeIdUri="urn:mpeg:dash:role:2011" value="subtitle"/>`,
        `\t\t\t<Representation id="${maxId + 1 + i}" mimeType="text/vtt" codecs="wvtt">`,
        `\t\t\t\t<BaseURL>${s.fileName}</BaseURL>`,
        `\t\t\t</Representation>`,
        `\t\t</AdaptationSet>`,
    ].join('\n')).join('\n');
    return stripped.replace('\n\t</Period>', `\n${sets}\n\t</Period>`);
};

export const rebuildAndUploadMpd = async (storageClient: StorageClient, vodStorageBucket: string, mediaId: string, streams: SubtitleStream[]): Promise<void> => {
    const rawStream = await storageClient.downloadObject(vodStorageBucket, `${mediaId}/output.mpd`);
    const raw = await streamToString(rawStream);
    const patched = injectSubtitleSets(stripSubtitleSets(raw), streams);
    await storageClient.uploadObject(vodStorageBucket, { key: `${mediaId}/output.mpd`, data: () => Readable.from(patched) });
};
