const $=s=>document.querySelector(s);
const cats=["Дороги","Освещение","Мусор","Снег и лёд","Дворы","Транспорт","Безопасность","Здания","Другое"];
const CITY={lat:54.14838,lng:49.76336,zoom:14};
let rows=[],mapState={lat:CITY.lat,lng:CITY.lng,zoom:CITY.zoom},drag=null;

const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const api=async(u,o)=>{const r=await fetch(u,o),x=await r.json();if(!r.ok)throw Error(x.error||"Ошибка");return x};

cats.forEach(c=>["cat","fc"].forEach(id=>{const o=document.createElement("option");o.value=c;o.textContent=c;$(id).append(o)}));

function project(lat,lng,z){
  const n=2**z, x=(lng+180)/360*n;
  const s=Math.sin(lat*Math.PI/180);
  const y=(1-Math.log((1+s)/(1-s))/(2*Math.PI))/2*n;
  return {x:x*256,y:y*256};
}
function unproject(x,y,z){
  const n=2**z, wx=x/256, wy=y/256;
  const lng=wx/n*360-180;
  const lat=180/Math.PI*Math.atan(Math.sinh(Math.PI*(1-2*wy/n)));
  return {lat,lng};
}
function initMap(){
  const el=$("#city-map");
  el.innerHTML='<div class="map-canvas"></div><div class="map-status">Загрузка карты…</div><div class="map-controls"><button type="button" data-zoom="in">+</button><button type="button" data-zoom="out">−</button><button type="button" data-center>⌾</button></div>';
  el.addEventListener("pointerdown",e=>{
    if(e.target.closest(".map-controls"))return;
    el.setPointerCapture?.(e.pointerId);
    drag={x:e.clientX,y:e.clientY,startX:mapState.lng,startY:mapState.lat,world:project(mapState.lat,mapState.lng,mapState.zoom)};
    el.classList.add("dragging");
  });
  el.addEventListener("pointermove",e=>{
    if(!drag)return;
    const dx=e.clientX-drag.x,dy=e.clientY-drag.y;
    const p=unproject(drag.world.x-dx,drag.world.y-dy,mapState.zoom);
    mapState.lat=Math.max(-85,Math.min(85,p.lat));mapState.lng=p.lng;
    renderMap();
  });
  const stop=()=>{drag=null;el.classList.remove("dragging")};
  el.addEventListener("pointerup",stop);el.addEventListener("pointercancel",stop);el.addEventListener("pointerleave",()=>{if(drag)stop()});
  el.addEventListener("click",e=>{
    if(drag)return;
    if(e.target.closest(".map-controls")||e.target.closest(".map-marker"))return;
    const r=el.getBoundingClientRect(),p=project(mapState.lat,mapState.lng,mapState.zoom);
    const q=unproject(p.x+(e.clientX-r.left-r.width/2),p.y+(e.clientY-r.top-r.height/2),mapState.zoom);
    $("[name=lat]").value=q.lat.toFixed(6);$("[name=lng]").value=q.lng.toFixed(6);
  });
  el.querySelector('[data-zoom="in"]').onclick=()=>zoomMap(1);
  el.querySelector('[data-zoom="out"]').onclick=()=>zoomMap(-1);
  el.querySelector("[data-center]").onclick=()=>{mapState={...CITY};renderMap()};
  renderMap();
}
function zoomMap(delta){
  const old=mapState.zoom,map=Math.max(10,Math.min(18,old+delta));
  if(map!==old){mapState.zoom=map;renderMap()}
}
function renderMap(){
  const el=$("#city-map"),canvas=el.querySelector(".map-canvas"),status=el.querySelector(".map-status");
  if(!canvas)return;
  const w=el.clientWidth,h=el.clientHeight,z=mapState.zoom,n=2**z;
  const center=project(mapState.lat,mapState.lng,z);
  const left=center.x-w/2,top=center.y-h/2;
  const tx0=Math.floor(left/256)-1,ty0=Math.floor(top/256)-1;
  const tx1=Math.floor((left+w)/256)+1,ty1=Math.floor((top+h)/256)+1;
  canvas.innerHTML="";
  let count=0;
  for(let ty=ty0;ty<=ty1;ty++)for(let tx=tx0;tx<=tx1;tx++){
    const wx=((tx%n)+n)%n,wy=ty;
    if(wy<0||wy>=n)continue;
    const img=document.createElement("img");
    img.className="map-tile";img.alt="";img.draggable=false;
    img.src="/tiles/"+z+"/"+wx+"/"+wy+".png";
    img.style.left=(tx*256-left)+"px";img.style.top=(ty*256-top)+"px";
    img.onload=()=>{count++;if(count>0)status.hidden=true};
    img.onerror=()=>{status.hidden=false;status.textContent="Не удалось загрузить карту. Повторяем…"};
    canvas.appendChild(img);
  }
  rows.forEach(r=>{
    const p=project(Number(r.lat),Number(r.lng),z);
    const x=p.x-left,y=p.y-top;
    if(x>=-20&&x<=w+20&&y>=-30&&y<=h+30){
      const m=document.createElement("button");m.type="button";m.className="map-marker";m.textContent="•";m.title=r.title;
      m.style.left=x+"px";m.style.top=y+"px";
      m.onclick=e=>{e.stopPropagation();alert(r.title+"\n"+(r.address||"Новая Майна"))};
      canvas.appendChild(m);
    }
  });
}
function filtered(){
  const q=$("#q").value.toLowerCase(),c=$("#cat").value,s=$("#st").value;
  return rows.filter(r=>(!q||(r.title+" "+r.description+" "+r.address).toLowerCase().includes(q))&&(!c||r.category===c)&&(!s||r.status===s));
}
function draw(){
  const a=filtered();$("#count").textContent=rows.length;
  $("#list").innerHTML=a.map(r=>'<article><div><b>'+esc(r.category)+'</b><em>'+esc(r.statusName)+'</em></div><h3>'+esc(r.title)+'</h3><p>'+esc(r.description)+'</p><small>📍 '+esc(r.address||r.lat+", "+r.lng)+' · 👥 '+r.confirmations+'</small><footer><button data-v="'+r.id+'">👍 Подтвердить</button><button data-c="'+r.id+'">💬 Комментарии</button></footer></article>').join("")||"<p>Ничего не найдено.</p>";
  renderMap();
}
async function load(){try{rows=(await api("/api/reports")).reports;draw()}catch(e){alert(e.message)}}

$("#list").onclick=async e=>{
  try{
    const v=e.target.closest("[data-v]"),c=e.target.closest("[data-c]");
    if(v){const x=await api("/api/reports/"+v.dataset.v+"/confirm",{method:"POST"});alert(x.confirmed?"Подтверждено":"Вы уже подтверждали");await load()}
    if(c){const x=await api("/api/reports/"+c.dataset.c+"/comments");alert(x.comments.map(z=>z.text).join("\n\n")||"Комментариев нет")}
  }catch(x){alert(x.message)}
};
["q","cat","st"].forEach(id=>$("#"+id).oninput=draw);
$("#reload").onclick=load;

const d=$("#dlg");
$("#new").onclick=()=>{
  d.showModal();
  navigator.geolocation?.getCurrentPosition(p=>{$("[name=lat]").value=p.coords.latitude;$("[name=lng]").value=p.coords.longitude;mapState={lat:p.coords.latitude,lng:p.coords.longitude,zoom:16};renderMap()},()=>{$("[name=lat]").value=CITY.lat;$("[name=lng]").value=CITY.lng;mapState={...CITY};renderMap()});
};
$("#close").onclick=()=>d.close();
$("#photo").onchange=e=>{const f=e.target.files[0];if(!f)return;const r=new FileReader();r.onload=()=>$("#preview").src=r.result;r.readAsDataURL(f)};
$("#form").onsubmit=async e=>{e.preventDefault();const x=Object.fromEntries(new FormData(e.target));x.photo=$("#preview").src||"";try{await api("/api/reports",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(x)});d.close();e.target.reset();$("#preview").removeAttribute("src");await load()}catch(x){alert(x.message)}};

window.addEventListener("resize",renderMap);
initMap();
load();