import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { TranscriptSegment } from "./whisper.js";
import type { HighlightPart } from "./highlights.js";

function formatTime(seconds: number): string {
  const totalMillis = Math.max(0, Math.round(seconds * 1000));
  const hours = Math.floor(totalMillis / 3_600_000);
  const minutes = Math.floor((totalMillis % 3_600_000) / 60_000);
  const whole = Math.floor((totalMillis % 60_000) / 1000);
  const millis = totalMillis % 1000;

  return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${whole.toString().padStart(2, "0")},${millis.toString().padStart(3, "0")}`;
}

function cleanText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

export async function createMontageSrt(segments:TranscriptSegment[],parts:HighlightPart[],outputPath:string):Promise<string>{
 const entries:string[]=[];let number=1,offset=0;
 for(const part of parts){for(const segment of segments){const a=Math.max(segment.start,part.start),b=Math.min(segment.end,part.end),text=cleanText(segment.text);if(!text||b<=a)continue;
  entries.push(number+++"\n"+formatTime(offset+a-part.start)+" --> "+formatTime(offset+b-part.start)+"\n"+text+"\n");}offset+=Math.max(0,part.end-part.start);}
 if(!entries.length)throw new Error("No subtitle segments overlap selected montage parts");await mkdir(dirname(outputPath),{recursive:true});await writeFile(outputPath,entries.join("\n"),"utf8");return outputPath;
}