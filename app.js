const SUPABASE_URL='https://jmpnkapzgvabadxlifrx.supabase.co';
const SUPABASE_PUBLISHABLE_KEY='sb_publishable_-mCWRp2IqqNNFa3W16kJ6A_3DQUkR79';

const db=window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY,
  {
    auth:{
      persistSession:true,
      autoRefreshToken:true,
      detectSessionInUrl:true
    }
  }
);

let state={
  projects:[],
  invoices:[],
  technicians:[],
  companies:[]
};

let currentSession=null;


/* =========================================================
   UTILIDADES
========================================================= */

function esc(v){
  return String(v??'').replace(
    /[&<>"']/g,
    m=>({
      '&':'&amp;',
      '<':'&lt;',
      '>':'&gt;',
      '"':'&quot;',
      "'":'&#039;'
    }[m])
  );
}

function normalizeCompany(v){
  const s=String(v??'').trim();
  const compact=s.toUpperCase().replace(/[^A-Z0-9]/g,'');

  if(compact==='IDE') return 'IDE';
  if(compact==='ENDESA') return 'ENDESA';
  if(compact==='UFD') return 'UFD';
  if(compact==='VIESGO') return 'VIESGO';

  return s||'SIN INDICAR';
}

function fmtDate(v){
  if(!v) return '';

  if(String(v).toUpperCase()==='RECLAMADO')
    return 'RECLAMADO';

  const m=String(v).match(/^(\d{4})-(\d{2})-(\d{2})$/);

  return m
    ? `${m[3]}/${m[2]}/${m[1]}`
    : v;
}

function monthName(period){

  const m={
    '01':'Enero',
    '02':'Febrero',
    '03':'Marzo',
    '04':'Abril',
    '05':'Mayo',
    '06':'Junio',
    '07':'Julio',
    '08':'Agosto',
    '09':'Septiembre',
    '10':'Octubre',
    '11':'Noviembre',
    '12':'Diciembre'
  };

  return `${m[period.slice(5,7)]} ${period.slice(0,4)}`;
}

function project(id){
  return state.projects.find(p=>p.id==id);
}

function calcStatus(i){

  if(i.status==='Pendiente de recibir')
    return 'Reclamada';

  if(i.status)
    return i.status;

  if(['sí','si'].includes(String(i.paid).toLowerCase()))
    return 'Pagada / GEA';

  if(i.sent)
    return 'Enviada';

  if(i.received)
    return 'Recibida';

  return 'Reclamada';
}

function badge(s){

  let c=
    s==='Pagada / GEA' ? 'paid' :
    s==='Enviada' ? 'sent' :
    s==='Recibida' ? 'received' :
    s==='Reclamada' ? 'claim' :
    'pending';

  return `<span class="badge ${c}">${esc(s)}</span>`;
}

function setBusy(on){
  document.body.classList.toggle('saving',!!on);
}

function showError(err,prefix='Error'){
  console.error(err);
  alert(`${prefix}: ${err?.message||err}`);
}


/* =========================================================
   MAPEO SUPABASE
========================================================= */

function mapProject(r){

  return {
    id:r.id,
    code:r.codigo||'',
    center:r.centro||'',
    promoter:r.promotor||'',
    tech:r.tecnico||'SIN ASIGNAR',
    company:normalizeCompany(r.compania),
    expedient:r.expediente||'',
    extension:r.ampliacion_potencia||'',
    permit:r.fecha_permiso||'',
    active:r.activo!==false,
    notes:r.observaciones||''
  };
}

function mapInvoice(r){

  return {
    id:String(r.id),
    projectId:r.proyecto_id,
    period:r.periodo,
    status:r.estado||'',

    received:
    r.fecha_recibida || '',

    sent:r.fecha_enviada||'',
    paid:r.pagado_gea||'',
    amount:r.importe??'',
    notes:r.observaciones||''
  };
}


/* =========================================================
   CARGAR DATOS
========================================================= */

async function refreshData(showMessage=false){

  setBusy(true);

  try{

    const [pRes,iRes,tRes,cRes]=await Promise.all([

      db.from('proyectos')
        .select('*')
        .order('id'),

      db.from('facturas')
        .select('*')
        .order('id'),

      db.from('tecnicos')
        .select('nombre')
        .order('nombre'),

      db.from('companias')
        .select('nombre')
        .order('nombre')

    ]);

    for(const r of [pRes,iRes,tRes,cRes]){
      if(r.error) throw r.error;
    }

    state.projects=pRes.data.map(mapProject);
    state.invoices=iRes.data.map(mapInvoice);

    state.technicians=[
      ...new Set([
        ...tRes.data.map(x=>x.nombre),
        ...state.projects.map(p=>p.tech)
      ].filter(Boolean))
    ].sort();

    state.companies=[
      ...new Set([
        ...cRes.data.map(x=>normalizeCompany(x.nombre)),
        ...state.projects.map(p=>normalizeCompany(p.company))
      ].filter(Boolean))
    ].sort();

    renderAll();

    if(showMessage)
      alert('Datos actualizados desde PostgreSQL.');

  }
  catch(e){

    showError(
      e,
      'No se pudieron cargar los datos'
    );

  }
  finally{

    setBusy(false);

  }
}


/* =========================================================
   NAVEGACIÓN
========================================================= */

function go(id){

  document.querySelectorAll('.page')
    .forEach(x=>x.classList.remove('active'));

  document.querySelectorAll('.nav')
    .forEach(x=>x.classList.remove('active'));

  document.getElementById(id)
    .classList.add('active');

  document.querySelector(
    `.nav[data-page="${id}"]`
  )?.classList.add('active');

  const n={
    dashboard:'Dashboard',
    projects:'Proyectos',
    invoices:'Facturas',
    technicians:'Técnicos',
    companies:'Compañías',
    monthly:'Control mensual',
    backup:'Base de datos'
  };

  pageTitle.textContent=n[id]||id;
}

document.querySelectorAll('.nav')
  .forEach(
    b=>b.onclick=()=>go(b.dataset.page)
  );


/* =========================================================
   SELECTORES Y FILTROS
========================================================= */

function fillSelects(){

  const tech=
    state.technicians
      .map(x=>`<option>${esc(x)}</option>`)
      .join('');

  const comp=
    state.companies
      .map(x=>`<option>${esc(x)}</option>`)
      .join('');

  const promoters=[
    ...new Set(
      state.projects
        .map(p=>p.promoter)
        .filter(Boolean)
    )
  ].sort();

  const promoterOptions=
    promoters
      .map(x=>`<option>${esc(x)}</option>`)
      .join('');


  const statuses=[
    'Pendiente de recibir',
    'Reclamada',
    'Recibida',
    'Enviada',
    'Pagada / GEA'
  ];


  ['projectTech','invoiceTech','monthlyTech']
    .forEach(id=>{

      document.getElementById(id).innerHTML=
        (
          id==='dashTech'
            ? '<option value="">Técnico · Todos</option>'
            : '<option value="">Todos los técnicos</option>'
        )
        +tech;

    });


  ['projectCompany','monthlyCompany']
    .forEach(id=>{

      document.getElementById(id).innerHTML=
        (
          id==='dashCompany'
            ? '<option value="">Compañía · Todas</option>'
            : '<option value="">Todas las compañías</option>'
        )
        +comp;

    });


 

  invoiceStatus.innerHTML=
    '<option value="">Todos los estados</option>'+
    statuses
      .map(x=>`<option>${x}</option>`)
      .join('');


  /* PROMOTOR EN PROYECTOS */

  if(document.getElementById('projectPromoter')){

    projectPromoter.innerHTML=
      '<option value="">Todos los promotores</option>'+
      promoterOptions;

  }
/* PROMOTOR EN CONTROL MENSUAL */

if(document.getElementById('monthlyPromoter')){

  monthlyPromoter.innerHTML=
    '<option value="">Todos los promotores</option>'+
    promoterOptions;

}

  /* PROMOTOR EN FACTURAS */

  if(document.getElementById('invoicePromoter')){

    invoicePromoter.innerHTML=
      '<option value="">Todos los promotores</option>'+
      promoterOptions;

  }
  


  const periods=[
    '2026-06',
    '2026-07',
    '2026-08',
    '2026-09',
    '2026-10',
    '2026-11',
    '2026-12'
  ];





  invoiceMonth.innerHTML=
    '<option value="">Todos los periodos</option>'+
    periods
      .map(p=>`<option value="${p}">${monthName(p)}</option>`)
      .join('');


  pTech.innerHTML=
    tech||'<option>SIN ASIGNAR</option>';


  pCompany.innerHTML=
    '<option value="">Sin indicar</option>'+
    comp;


  iProject.innerHTML=
    state.projects
      .map(
        p=>
          `<option value="${p.id}">
            ${esc(p.code)} ·
            ${esc(p.center)} ·
            ${esc(p.promoter)} ·
            ${esc(p.expedient)}
          </option>`
      )
      .join('');
}


/* =========================================================
   DASHBOARD
========================================================= */

function renderDashboard(){

  const sts=
    state.invoices.map(calcStatus);


  kProjects.textContent=
    state.projects
      .filter(p=>p.active!==false)
      .length;


    kPending.textContent=
    sts.filter(
        x=>x==='Reclamada'
    ).length;


  kReceived.textContent=
    sts.filter(
      x=>x==='Recibida'
    ).length;


  kSent.textContent=
    sts.filter(
      x=>x==='Enviada'
    ).length;


  kPaid.textContent=
    sts.filter(
      x=>x==='Pagada / GEA'
    ).length;


  const groups=[

    [
      'Reclamada',
      'Facturas reclamadas y no recibidas',
      'Requieren seguimiento'
    ],

    [
      'Recibida',
      'Facturas recibidas pero no enviadas',
      'Pendientes de enviar al cliente'
    ],

    [
      'Enviada',
      'Facturas enviadas pendientes de pago/GEA',
      'Pendientes de confirmación'
    ],

  

  ];
  const proyectosSinFactura=
  state.projects.filter(p=>
    !state.invoices.some(i=>i.projectId===p.id)
  ).length;

  alerts.innerHTML=
    groups.map(([st,t,sub])=>{

      const n=
        sts.filter(x=>x===st).length;

      return `
        <div class="alertRow">

          <div>
            <b>${t}</b>
            <small>${sub}</small>
          </div>

          <span class="alertCount">
            ${n}
          </span>

        </div>
      `;

    }).join('');
            alerts.innerHTML += `
        <div
            class="alertRow"
            onclick="goToProjectsWithoutInvoices()"
            style="cursor:pointer;"
        >

            <div>
            <b>Facturas NO realizadas</b>
            <small>Proyectos sin ninguna factura registrada</small>
            </div>

            <span class="alertCount">
            ${proyectosSinFactura}
            </span>

        </div>
        `;

  const counts={};

  state.invoices.forEach(i=>{

    const p=project(i.projectId);

    const c=
      normalizeCompany(p?.company);

    counts[c]=(counts[c]||0)+1;

  });


  const max=
    Math.max(
      1,
      ...Object.values(counts)
    );


  companyBars.innerHTML=
    Object.entries(counts)
      .sort((a,b)=>b[1]-a[1])
      .map(
        ([k,v])=>
          `<div class="barCol">

            <div
              class="bar"
              style="height:${30+110*v/max}px">

              <b>${v}</b>

            </div>

            ${esc(k)}

          </div>`
      )
      .join('');


  const vals=[
    'Pendiente de recibir',
    'Reclamada',
    'Recibida',
    'Enviada',
    'Pagada / GEA'
  ].map(
    s=>sts.filter(x=>x===s).length
  );


  const total=sts.length;

  const colors=[
    '#aab4c4',
    '#8659df',
    '#f3aa24',
    '#3577df',
    '#25a566'
  ];


  donutTotal.textContent=total;


  let start=0;
  let parts=[];


  vals.forEach((v,i)=>{

    const deg=
      total
        ?360*v/total
        :0;

    parts.push(
      `${colors[i]} ${start}deg ${start+deg}deg`
    );

    start+=deg;

  });


  donut.style.background=
    `conic-gradient(${parts.join(',')})`;


  const labs=[
    'Pendientes de recibir',
    'Reclamadas',
    'Recibidas',
    'Enviadas',
    'Pagadas / GEA'
  ];


  statusLegend.innerHTML=
    labs.map(
      (l,i)=>
        `<div class="legendItem">

          <span>
            <i
              class="legendDot"
              style="background:${colors[i]}">
            </i>

            ${l}
          </span>

          <b>${vals[i]}</b>

        </div>`
    )
    .join('');




}


/* =========================================================
   FILTRADO DE FACTURAS
========================================================= */

function filteredInvoices(
  search,
  tech,
  company,
  status,
  period,
  promoter=''
){

  const q=
    (search||'').toLowerCase();


  return state.invoices.filter(i=>{

    const p=project(i.projectId);

    const st=calcStatus(i);


    const blob=`
      ${p?.code}
      ${p?.center}
      ${p?.promoter}
      ${p?.expedient}
    `.toLowerCase();


    return (
      (!q || blob.includes(q))
      &&
      (!tech || p?.tech===tech)
      &&
      (!company ||
        normalizeCompany(p?.company)===company)
      &&
      (!status || st===status)
      &&
      (!period || i.period===period)
      &&
      (!promoter || p?.promoter===promoter)
    );

  });

}


/* =========================================================
   FILA FACTURA
========================================================= */

function rowInvoice(i){

  const p=project(i.projectId);
  const st=calcStatus(i);

  return `
    <tr>

      <td>${esc(p?.code)}</td>

      <td>${esc(p?.center)}</td>

      <td>${esc(p?.promoter)}</td>

      <td>${esc(p?.expedient)}</td>

      <td>
        ${esc(
          normalizeCompany(p?.company)
        )}
      </td>

      <td>${esc(p?.tech)}</td>

      <td>
        ${esc(monthName(i.period))}
      </td>

      <td>${badge(st)}</td>

      <td>
        ${esc(fmtDate(i.received))}
      </td>

      <td>
        ${esc(fmtDate(i.sent))}
      </td>

      <td>
        ${esc(i.paid)}
      </td>

      <td>

        <button
          class="actionBtn"
          onclick="openInvoice('${i.id}')">

          Editar

        </button>

      </td>

    </tr>
  `;
}


/* =========================================================
   TABLA DASHBOARD
========================================================= */


/* =========================================================
   TABLA FACTURAS
========================================================= */

function renderInvoices(){

  const promoter=
    document.getElementById('invoicePromoter')
      ? invoicePromoter.value
      : '';


  invoicesBody.innerHTML=

    filteredInvoices(
      invoiceSearch.value,
      invoiceTech.value,
      '',
      invoiceStatus.value,
      invoiceMonth.value,
      promoter
    )
    .map(rowInvoice)
    .join('');

}


/* =========================================================
   FILTRO DESDE TARJETAS
========================================================= */

function filterStatus(st){

  go('invoices');

  invoiceStatus.value=st;

  renderInvoices();

}


/* =========================================================
   PROYECTOS
========================================================= */

function renderProjects(){

  const q=
    (projectSearch.value||'')
      .toLowerCase();

  const t=
    projectTech.value;

  const promoter=
    projectPromoter.value;

  const c=
    projectCompany.value;


  projectsBody.innerHTML=

    state.projects
      .filter(p=>{

        const texto=`
          ${p.code}
          ${p.center}
          ${p.promoter}
          ${p.expedient}
        `.toLowerCase();


        return (
          (!q || texto.includes(q))
          &&
          (!t || p.tech===t)
          &&
          (!promoter || p.promoter===promoter)
          &&
          (!c ||
            normalizeCompany(p.company)===c)
        );

      })

      .map(p=>`

        <tr>

          <td>${esc(p.code)}</td>

          <td>${esc(p.center)}</td>

          <td>${esc(p.promoter)}</td>

          <td>${esc(p.expedient)}</td>

          <td>
            ${esc(
              normalizeCompany(p.company)
            )}
          </td>

          <td>${esc(p.tech)}</td>

          <td>${esc(p.extension)}</td>

          <td>
            ${esc(fmtDate(p.permit))}
          </td>

          <td>

            <button
              class="actionBtn"
              onclick="openProject(${p.id})">

              Editar

            </button>

          </td>

        </tr>

      `)

      .join('');

}
function goToProjectsWithoutInvoices(){

  go('projects');

  projectSearch.value='';
  projectTech.value='';
  projectPromoter.value='';
  projectCompany.value='';

  projectsBody.innerHTML=
    state.projects
      .filter(p =>
        !state.invoices.some(i => i.projectId === p.id)
      )
      .map(p=>`

        <tr>

          <td>${esc(p.code)}</td>
          <td>${esc(p.center)}</td>
          <td>${esc(p.promoter)}</td>
          <td>${esc(p.expedient)}</td>
          <td>${esc(normalizeCompany(p.company))}</td>
          <td>${esc(p.tech)}</td>
          <td>${esc(p.extension)}</td>
          <td>${esc(fmtDate(p.permit))}</td>

          <td>
            <button
              class="actionBtn"
              onclick="openProject(${p.id})">
              Editar
            </button>
          </td>

        </tr>

      `)
      .join('');
}

/* =========================================================
   TARJETAS TÉCNICOS / COMPAÑÍAS
========================================================= */

function renderCards(){

  techCards.innerHTML=

    state.technicians
      .map(
        t=>
          `<div
            class="card miniCard"
            onclick="goToTechnicianProjects('${esc(t)}')"
            style="cursor:pointer;">

            <b>${esc(t)}</b>

            <small>
              ${
                state.projects
                  .filter(p=>p.tech===t)
                  .length
              }
              proyectos
            </small>

          </div>`
      )
      .join('');


companyCards.innerHTML=

  state.companies
    .map(
      t=>
        `<div
          class="card miniCard"
          onclick="goToCompanyProjects('${esc(t)}')"
          style="cursor:pointer;">

          <b>${esc(t)}</b>

          <small>
            ${
              state.projects
                .filter(
                  p=>
                    normalizeCompany(
                      p.company
                    )===t
                )
                .length
            }
            proyectos
          </small>

        </div>`
    )
    .join('');
}

function goToTechnicianProjects(tecnico){

  go('invoices');

  invoiceTech.value=tecnico;

  renderInvoices();

}
function goToCompanyProjects(compania){

  go('projects');

  projectCompany.value=compania;

  renderProjects();

}

/* =========================================================
   CONTROL MENSUAL
========================================================= */

function renderMonthly(){

  const q=
    (monthlySearch.value||'')
      .toLowerCase();

  const t=
    monthlyTech.value;

  const promoter=
    monthlyPromoter.value;

  const c=
    monthlyCompany.value;


  const periods=[
    '2026-06',
    '2026-07',
    '2026-08',
    '2026-09',
    '2026-10',
    '2026-11',
    '2026-12'
  ];


  monthlyBody.innerHTML=

    state.projects

      .filter(p=>{

        const texto=`
          ${p.code}
          ${p.center}
          ${p.promoter}
          ${p.expedient}
        `.toLowerCase();


        return (
          (!q || texto.includes(q))
          &&
          (!t || p.tech===t)
          &&
          (
            !promoter ||
            String(p.promoter || '')
              .trim()
              .toUpperCase()
              ===
            String(promoter || '')
              .trim()
              .toUpperCase()
          )
          &&
          (!c ||
            normalizeCompany(
              p.company
            )===c)
        );

      })

      .map(p=>{

        const cells=

          periods.map(period=>{

            const i=
              state.invoices.find(
                x=>
                  x.projectId===p.id
                  &&
                  x.period===period
              );


            if(!i){

              return `
                <td
                  ondblclick="openNewInvoiceFor(${p.id},'${period}')">
                </td>

                <td
                  ondblclick="openNewInvoiceFor(${p.id},'${period}')">
                </td>

                <td
                  ondblclick="openNewInvoiceFor(${p.id},'${period}')">
                </td>
              `;

            }


            const st=
              calcStatus(i);


            const rc=
              st==='Reclamada'
                ?'cellClaim'
                :i.received
                  ?'cellYellow'
                  :'';


            const sc=
              i.sent
                ?'cellBlue'
                :'';


            const pc=
              String(i.paid).toLowerCase()==='sí'
                ?'cellGreen'
                :String(i.paid).toLowerCase()==='no'
                  ?'cellRed'
                  :'';


            return `

              <td
                class="${rc}"
                ondblclick="openInvoice('${i.id}')">

                ${esc(fmtDate(i.received))}

              </td>


              <td
                class="${sc}"
                ondblclick="openInvoice('${i.id}')">

                ${esc(fmtDate(i.sent))}

              </td>


              <td
                class="${pc}"
                ondblclick="openInvoice('${i.id}')">

                ${esc(i.paid)}

              </td>

            `;

          }).join('');


        return `

          <tr>

            <td>${esc(p.code)}</td>

            <td>${esc(p.center)}</td>

            <td>${esc(p.promoter)}</td>

            <td>${esc(p.tech)}</td>

            <td>
              ${esc(
                normalizeCompany(
                  p.company
                )
              )}
            </td>

            <td>${esc(p.expedient)}</td>

            <td>${esc(p.extension)}</td>

            <td>
              ${esc(fmtDate(p.permit))}
            </td>

            ${cells}

          </tr>

        `;

      })

      .join('');

}

/* =========================================================
   RENDER GENERAL
========================================================= */

function renderAll(){

  fillSelects();

  renderDashboard();

  renderInvoices();

  renderProjects();

  renderCards();

  renderMonthly();

}


/* =========================================================
   ABRIR PROYECTO
========================================================= */

function openProject(id){

  const p=
    id
      ?project(id)
      :null;


  pId.value=
    p?.id||'';


  pCode.value=
    p?.code||'';


  pCenter.value=
    p?.center||'';


  pPromotor.value=
    p?.promoter||'';


  pExp.value=
    p?.expedient||'';


  pCompany.value=
    normalizeCompany(
      p?.company||''
    );


  pTech.value=
    p?.tech||
    state.technicians[0]||
    '';


  pExtension.value=
    p?.extension||'';


  pPermit.value=
    /^\d{4}-/.test(
      p?.permit||''
    )
      ?p.permit
      :'';


  pActive.value=
    String(
      p?.active!==false
    );


  projectTitle.textContent=
    p
      ?'Editar proyecto'
      :'Nuevo proyecto';
    deleteProjectBtn.style.display=
    p ? 'inline-block' : 'none';

  projectDialog.showModal();

}


/* =========================================================
   GUARDAR PROYECTO
========================================================= */
async function deleteProject(){

  const id=Number(pId.value);

  if(!id) return;

  const p=project(id);

  const numFacturas=
    state.invoices.filter(
      i=>i.projectId===id
    ).length;

  const mensaje=
    numFacturas>0
      ? `¿Seguro que quieres eliminar el proyecto "${p?.center}"?\n\nTambién se eliminarán ${numFacturas} factura(s) asociada(s).\n\nEsta acción no se puede deshacer.`
      : `¿Seguro que quieres eliminar el proyecto "${p?.center}"?\n\nEsta acción no se puede deshacer.`;

  if(!confirm(mensaje))
    return;

  setBusy(true);

  try{

    const {error}=
      await db
        .from('proyectos')
        .delete()
        .eq('id',id);

    if(error)
      throw error;

    projectDialog.close();

    await refreshData();

  }
  catch(err){

    showError(
      err,
      'No se pudo eliminar el proyecto'
    );

  }
  finally{

    setBusy(false);

  }

}


async function saveProject(e){

  e.preventDefault();


  const id=
    Number(pId.value)||null;


  const row={

    codigo:
      pCode.value.trim()||null,

    centro:
      pCenter.value.trim(),

    promotor:
      pPromotor.value.trim()||null,

    expediente:
      pExp.value.trim()||null,

    compania:
      normalizeCompany(
        pCompany.value
      ),

    tecnico:
      pTech.value||
      'SIN ASIGNAR',

    ampliacion_potencia:
      pExtension.value||null,

    fecha_permiso:
      pPermit.value||null,

    activo:
      pActive.value==='true',

    updated_at:
      new Date().toISOString()

  };


  setBusy(true);


  try{

    let r;


    if(id){

      r=
        await db
          .from('proyectos')
          .update(row)
          .eq('id',id);

    }
    else{

      r=
        await db
          .from('proyectos')
          .insert(row);

    }


    if(r.error)
      throw r.error;


    projectDialog.close();


    await refreshData();

  }
  catch(err){

    showError(
      err,
      'No se pudo guardar el proyecto'
    );

  }
  finally{

    setBusy(false);

  }

}


/* =========================================================
   ABRIR FACTURA
========================================================= */

function openInvoice(id){

  const i=
    id
      ?state.invoices.find(
        x=>x.id===String(id)
      )
      :null;


  iId.value=
    i?.id||'';


  iProject.value=
    i?.projectId||
    state.projects[0]?.id||
    '';


  iPeriod.value=
    i?.period||
    '2026-09';


  iStatus.value=
    i
      ?calcStatus(i)
      :'Reclamada';


  iReceived.value=
    /^\d{4}-/.test(
      i?.received||''
    )
      ?i.received
      :'';


  iSent.value=
    /^\d{4}-/.test(
      i?.sent||''
    )
      ?i.sent
      :'';


  iPaid.value=
    i?.paid||'';


  iAmount.value=
    i?.amount??'';


  iNotes.value=
    i?.notes||'';


  invoiceTitle.textContent=
    i
      ?'Editar factura'
      :'Añadir factura';

    deleteInvoiceBtn.style.display=
        i ? 'inline-block' : 'none';
  invoiceDialog.showModal();

}


/* =========================================================
   NUEVA FACTURA DESDE CONTROL MENSUAL
========================================================= */
async function deleteInvoice(){

  const id=Number(iId.value);

  if(!id) return;

  const i=
    state.invoices.find(
      x=>Number(x.id)===id
    );

  if(!i) return;

  const p=project(i.projectId);

  const mensaje=
    `¿Seguro que quieres eliminar esta factura?\n\n`+
    `Proyecto: ${p?.code||''}\n`+
    `Centro: ${p?.center||''}\n`+
    `Periodo: ${monthName(i.period)}\n\n`+
    `Esta acción no se puede deshacer.`;

  if(!confirm(mensaje))
    return;

  setBusy(true);

  try{

    const {error}=
      await db
        .from('facturas')
        .delete()
        .eq('id',id);

    if(error)
      throw error;

    invoiceDialog.close();

    await refreshData();

  }
  catch(err){

    showError(
      err,
      'No se pudo eliminar la factura'
    );

  }
  finally{

    setBusy(false);

  }

}
function openNewInvoiceFor(
  projectId,
  period
){

  openInvoice();

  iProject.value=
    projectId;

  iPeriod.value=
    period;

  iStatus.value=
    'Reclamada';

  invoiceTitle.textContent=
    'Añadir factura';

}


/* =========================================================
   SINCRONIZAR ESTADOS
========================================================= */

function syncStatusFields(){

  const s=
    iStatus.value;


  if(s==='Reclamada'){

    iReceived.value='';
    iSent.value='';
    iPaid.value='';

  }


  if(s==='Pendiente de recibir'){

    iReceived.value='';
    iSent.value='';
    iPaid.value='';

  }


  if(s==='Recibida'){

    iSent.value='';

    if(iPaid.value==='Sí')
      iPaid.value='';

  }


  if(
    s==='Enviada'
    &&
    iPaid.value==='Sí'
  ){

    iPaid.value='No';

  }


  if(s==='Pagada / GEA'){

    iPaid.value='Sí';

  }

}


/* =========================================================
   GUARDAR FACTURA
========================================================= */

async function saveInvoice(e){

  e.preventDefault();


  const id=
    iId.value
      ?Number(iId.value)
      :null;


  const pid=
    Number(iProject.value);


  const period=
    iPeriod.value;


  const s=
    iStatus.value;


  let rec=
    iReceived.value||null;


  let sent=
    iSent.value||null;


  let paid=
    iPaid.value||null;


  if(s==='Reclamada'){

    rec=null;
    sent=null;
    paid=null;

  }


  if(s==='Pendiente de recibir'){

    rec=null;
    sent=null;
    paid=null;

  }


  if(s==='Recibida'){

    if(!rec){

      alert(
        'Indica la fecha de recibido.'
      );

      return;

    }

    sent=null;

    if(paid==='Sí')
      paid=null;

  }


  if(
    s==='Enviada'
    &&
    !sent
  ){

    alert(
      'Indica la fecha de enviado.'
    );

    return;

  }


  if(
    s==='Enviada'
    &&
    !paid
  ){

    paid='No';

  }


  if(s==='Pagada / GEA'){

    paid='Sí';

  }


  const row={

    proyecto_id:pid,

    periodo:period,

    estado:s,

    fecha_recibida:rec,

    fecha_enviada:sent,

    pagado_gea:paid,

    importe:
      iAmount.value
        ?Number(iAmount.value)
        :null,

    observaciones:
      iNotes.value||null,

    updated_at:
      new Date().toISOString()

  };


  setBusy(true);


  try{

    let r;


    if(id){

      r=
        await db
          .from('facturas')
          .update(row)
          .eq('id',id);

    }
    else{

      const same=
        state.invoices.find(
          x=>
            x.projectId===pid
            &&
            x.period===period
        );


      if(same){

        if(
          !confirm(
            'Ya existe una factura para este proyecto y periodo. ¿Quieres actualizarla?'
          )
        ){

          return;

        }


        r=
          await db
            .from('facturas')
            .update(row)
            .eq(
              'id',
              Number(same.id)
            );

      }
      else{

        r=
          await db
            .from('facturas')
            .insert(row);

      }

    }


    if(r.error)
      throw r.error;


    invoiceDialog.close();


    await refreshData();

  }
  catch(err){

    showError(
      err,
      'No se pudo guardar la factura'
    );

  }
  finally{

    setBusy(false);

  }

}


/* =========================================================
   TÉCNICOS / COMPAÑÍAS
========================================================= */

function openSimple(type){

  simpleType.value=type;

  simpleName.value='';

  simpleTitle.textContent=
    type==='technician'
      ?'Añadir técnico'
      :'Añadir compañía';

  simpleDialog.showModal();

}


async function saveSimple(e){

  e.preventDefault();


  let n=
    simpleName.value.trim();


  const table=
    simpleType.value==='technician'
      ?'tecnicos'
      :'companias';


  if(table==='companias'){

    n=
      normalizeCompany(n);

  }


  setBusy(true);


  try{

    const r=
      await db
        .from(table)
        .upsert(
          {nombre:n},
          {onConflict:'nombre'}
        );


    if(r.error)
      throw r.error;


    simpleDialog.close();


    await refreshData();

  }
  catch(err){

    showError(
      err,
      'No se pudo guardar'
    );

  }
  finally{

    setBusy(false);

  }

}


/* =========================================================
   COPIA JSON
========================================================= */

function exportJSON(){

  const b=
    new Blob(
      [
        JSON.stringify(
          state,
          null,
          2
        )
      ],
      {
        type:'application/json'
      }
    );


  const a=
    document.createElement('a');


  a.href=
    URL.createObjectURL(b);


  a.download=
    'copia_control_facturas_supabase.json';


  a.click();


  URL.revokeObjectURL(a.href);

}
/* =========================================================
   DESCARGAR CONTROL MENSUAL EN EXCEL
========================================================= */

function exportMonthlyExcel(){

    alert('EL BOTÓN FUNCIONA');
  const q=
    (monthlySearch.value||'')
      .toLowerCase();

  const t=
    monthlyTech.value;

  const promoter=
    monthlyPromoter.value;

  const c=
    monthlyCompany.value;

  const periods=[
    '2026-06',
    '2026-07',
    '2026-08',
    '2026-09',
    '2026-10',
    '2026-11',
    '2026-12'
  ];


  const filteredProjects=
    state.projects.filter(p=>{

      const texto=`
        ${p.code}
        ${p.center}
        ${p.promoter}
        ${p.expedient}
      `.toLowerCase();

      return (
        (!q || texto.includes(q))
        &&
        (!t || p.tech===t)
        &&
        (
          !promoter ||
          String(p.promoter||'')
            .trim()
            .toUpperCase()
          ===
          String(promoter||'')
            .trim()
            .toUpperCase()
        )
        &&
        (!c ||
          normalizeCompany(p.company)===c)
      );

    });


  if(filteredProjects.length===0){

    alert(
      'No hay datos para exportar con los filtros seleccionados.'
    );

    return;

  }


  const rows=
    filteredProjects.map(p=>{

      const row={
        'PROYECTO':p.code,
        'CENTRO':p.center,
        'PROMOTOR':p.promoter,
        'TÉCNICO':p.tech,
        'COMPAÑÍA':normalizeCompany(p.company),
        'EXPEDIENTE':p.expedient,
        'AMPLIACIÓN':p.extension,
        'PERMISO A&C':fmtDate(p.permit)
      };


      periods.forEach(period=>{

        const i=
          state.invoices.find(
            x=>
              x.projectId===p.id
              &&
              x.period===period
          );

        const month=
          monthName(period)
            .replace(' 2026','')
            .toUpperCase();


        row[`${month} - RECIBIDO`]=
          i ? fmtDate(i.received) : '';

        row[`${month} - ENVIADO`]=
          i ? fmtDate(i.sent) : '';

        row[`${month} - PAGADO/GEA`]=
          i ? i.paid : '';

      });


      return row;

    });


  const ws=
    XLSX.utils.json_to_sheet(rows);

  const wb=
    XLSX.utils.book_new();


  XLSX.utils.book_append_sheet(
    wb,
    ws,
    'Control mensual'
  );


  let fileName='Control_mensual';

  if(promoter)
    fileName+=`_${promoter}`;

  if(t)
    fileName+=`_${t}`;

  if(c)
    fileName+=`_${c}`;


  XLSX.writeFile(
    wb,
    `${fileName}.xlsx`
  );

}

/* =========================================================
   LOGIN
========================================================= */

async function login(e){

  e.preventDefault();


  loginError.textContent='';


  const email=
    loginEmail.value.trim();


  const password=
    loginPassword.value;


  const {data,error}=
    await db.auth.signInWithPassword({
      email,
      password
    });


  if(error){

    loginError.textContent=
      'Correo o contraseña incorrectos.';

    return;

  }


  await showApp(
    data.session
  );

}


/* =========================================================
   LOGOUT
========================================================= */

async function logout(){

  await db.auth.signOut();

  currentSession=null;

  appLayout.hidden=true;

  loginScreen.style.display='grid';

  loginPassword.value='';

}


/* =========================================================
   MOSTRAR APP
========================================================= */

async function showApp(session){

  currentSession=session;

  loginScreen.style.display='none';

  appLayout.hidden=false;


  currentUserEmail.textContent=
    session.user.email||'';


  currentUserName.textContent=
    (
      session.user.email||
      'Usuario'
    ).split('@')[0];


  await refreshData();

}


/* =========================================================
   FORMULARIO LOGIN
========================================================= */

loginForm.addEventListener(
  'submit',
  login
);


/* =========================================================
   CAMBIOS DE SESIÓN
========================================================= */

db.auth.onAuthStateChange(
  (event,session)=>{

    if(event==='SIGNED_OUT'){

      appLayout.hidden=true;

      loginScreen.style.display='grid';

    }

  }
);


/* =========================================================
   INICIO
========================================================= */

(async()=>{

  const {
    data:{session}
  }=
    await db.auth.getSession();


  if(session){

    await showApp(session);

  }
  else{

    loginScreen.style.display='grid';

    appLayout.hidden=true;

  }

})();