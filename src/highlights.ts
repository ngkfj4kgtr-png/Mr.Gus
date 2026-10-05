import type { TranscriptSegment } from "./whisper.js";
export type HighlightPart={start:number;end:number};
export type Highlight={start:number;end:number;duration:number;text:string;score:number;parts:HighlightPart[]};
const MIN_CLIP=6,MAX_CLIP=15,TARGET_SHORT=30,MAX_SHORT=45,MAX_RESULTS=3,MAX_PARTS=3;
const HOOK_WORDS=["почему","зачем","как","смотрите","представьте","оказалось","самое","главное","никогда","никто","всегда","секрет","реально","серьезно","неожиданно","прикиньте","жесть","капец","интересно"];
const PAYOFF_WORDS=["поэтому","в итоге","оказалось","получается","вот и всё","вот почему","вот что","на самом деле","короче","итак"];
const FILLER_STARTS=["ну","ээ","эм","короче говоря","как бы","в общем","значит"];
function normalize(t:string){return t.toLowerCase().replace(/[«»"“”]/g,"").replace(/\s+/g," ").trim();}
function hasPhrase(t:string,p:string){const e=p.replace(/[.*+?^$()|[\]{}]/g,"\\$&");return new RegExp("(?:^|\\s)"+e+"(?:\\s|$)","i").test(t);}
function countMatches(t:string,w:string[]){return w.reduce((n,x)=>n+(hasPhrase(t,normalize(x))?1:0),0);}
function words(t:string){return t.split(/\s+/).filter(Boolean).length;}
function scoreClip(text:string,d:number,first:TranscriptSegment,last:TranscriptSegment,videoDuration:number){
 const n=normalize(text),w=words(n); if(!w||d<MIN_CLIP)return 0; const density=w/Math.max(1,d);
 let s=density>=1.5&&density<=4.2?25:density>=1&&density<=5?12:3;
 s+=Math.min(28,countMatches(n,HOOK_WORDS)*7)+Math.min(18,countMatches(n,PAYOFF_WORDS)*6)+Math.min(14,(text.match(/[?!]/g)??[]).length*4);
 s+=Math.max(0,12-Math.round(Math.abs(d-11))); const firstText=normalize(first.text);
 if(FILLER_STARTS.some(x=>firstText===x||firstText.startsWith(x+" ")))s-=12; if(last.end>=videoDuration-0.5)s+=2;
 return Math.max(0,Math.min(100,Math.round(s)));
}
function clips(segments:TranscriptSegment[],videoDuration:number){
 const out:Highlight[]=[];
 for(let i=0;i<segments.length;i++){const start=Math.max(0,segments[i].start-0.5);
  for(const target of [8,11,14]){let last=i;while(last+1<segments.length&&segments[last+1].end<=start+target+2)last++;
   const end=Math.min(videoDuration,Math.max(start+MIN_CLIP,segments[last].end)),duration=end-start;if(duration<MIN_CLIP||duration>MAX_CLIP)continue;
   const text=segments.slice(i,last+1).map(x=>x.text).join(" ").trim();if(!text)continue;
   out.push({start,end,duration,text,score:scoreClip(text,duration,segments[i],segments[last],videoDuration),parts:[{start,end}]});
  }} return out.sort((a,b)=>b.score-a.score);
}
export function findBestMoments(segments:TranscriptSegment[],videoDuration:number):Highlight[]{
 if(!segments.length||videoDuration<=0)return [];const c=clips(segments,videoDuration),selected:Highlight[]=[],used:HighlightPart[]=[];
 for(const first of c){if(first.score<12||used.some(p=>Math.max(p.start,first.start)<Math.min(p.end,first.end)))continue;
  const parts=[first.parts[0]],texts=[first.text];let total=first.duration;
  for(const next of c){if(parts.length>=MAX_PARTS||total>=TARGET_SHORT)break;
   if(used.some(p=>Math.max(p.start,next.start)<Math.min(p.end,next.end))||parts.some(p=>Math.max(p.start,next.start)<Math.min(p.end,next.end)))continue;
   if(next.start<=first.end+1||total+next.duration>MAX_SHORT||next.score-Math.min(8,Math.max(0,(next.start-first.end)/10))<25)continue;
   parts.push(next.parts[0]);total+=next.duration;texts.push(next.text);
  }
  if(total<16){ continue; }parts.sort((a,b)=>a.start-b.start);
  const avg=parts.reduce((sum,p)=>{const x=c.find(y=>y.start===p.start&&y.end===p.end);return sum+(x?.score??0);},0)/parts.length;
  selected.push({start:parts[0].start,end:parts[parts.length-1].end,duration:total,text:texts.join(" … "),score:Math.min(100,Math.round(avg+parts.length*4)),parts});
  used.push(...parts);if(selected.length===MAX_RESULTS)break;
 } return selected.sort((a,b)=>a.start-b.start);
}