/* Malla Tablero, variante C.
   Mira el mismo calculo desde la gerencia de operaciones, y responde la pregunta que
   quedo abierta con el director: hasta donde llega la capa de lenguaje natural.
   Aca la consulta no estima nada. Repite numeros que el pipeline deterministico ya
   produjo, y muestra de donde sale cada uno. */

(function () {
  "use strict";

  var D = window.MALLA;

  var BORDO = "#7b1e2b";
  var FRIO = "#3d5a5f";

  var MESES = ["ene", "feb", "mar", "abr", "may", "jun",
               "jul", "ago", "sep", "oct", "nov", "dic"];

  var MESES_LARGOS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio",
                      "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

  var estado = { ciudad: "bahia_blanca", periodo: 0, pregunta: null };

  function num(n) { return Math.round(n).toLocaleString("es-AR"); }

  function el(tag, attrs, hijos) {
    var e = document.createElementNS("http://www.w3.org/2000/svg", tag);
    Object.keys(attrs || {}).forEach(function (k) { e.setAttribute(k, attrs[k]); });
    (hijos || []).forEach(function (h) { e.appendChild(h); });
    return e;
  }

  /* Cortes de eje en numeros redondos, para que la grilla no mienta. */
  function pasoLindo(rango, cortes) {
    var crudo = rango / cortes;
    var mag = Math.pow(10, Math.floor(Math.log(crudo) / Math.LN10));
    var n = crudo / mag;
    var paso = n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10;
    return paso * mag;
  }

  function texto(tag, attrs, contenido) {
    var e = el(tag, attrs);
    e.textContent = contenido;
    return e;
  }

  /* ---------- indicadores ---------- */

  function indicadores() {
    var c = D.ciudades[estado.ciudad];

    var criticos = c.tramos.filter(function (t) { return t.score >= 95; });
    var vencidos = c.tramos.filter(function (t) { return t.dias > 365; });
    var criticosVencidos = criticos.filter(function (t) { return t.dias > 365; });

    var km = 0, hogares = 0;
    c.tramos.forEach(function (t) { km += t.largo; });
    criticos.forEach(function (t) { hogares += t.hogares; });

    var riesgoTotal = 0, riesgoCritico = 0;
    c.tramos.forEach(function (t) { riesgoTotal += t.crit; });
    criticos.forEach(function (t) { riesgoCritico += t.crit; });

    var datos = [
      {
        rotulo: "Red bajo seguimiento",
        valor: num(km / 1000),
        unidad: "km",
        pie: num(c.tramos.length) + " tramos en " + c.nombre + ", con " +
             num(c.receptores.length) + " receptores sensibles relevados."
      },
      {
        rotulo: "Concentración del riesgo",
        valor: (riesgoCritico / riesgoTotal * 100).toFixed(0),
        unidad: "%",
        pie: "del riesgo total vive en los " + num(criticos.length) +
             " tramos críticos, que son el " + (criticos.length / c.tramos.length * 100).toFixed(0) +
             " % de la red."
      },
      {
        rotulo: "Hogares expuestos",
        valor: num(hogares),
        unidad: "",
        pie: "cuelgan de un tramo crítico. Es la cifra que hoy nadie calcula."
      },
      {
        rotulo: "Deuda de inspección",
        valor: num(criticosVencidos.length),
        unidad: "",
        pie: "tramos críticos llevan más de un año sin inspección, sobre " +
             num(vencidos.length) + " vencidos en total."
      }
    ];

    document.getElementById("indicadores").innerHTML = datos.map(function (d) {
      return '<div class="indicador">' +
        '<p class="indicador-rotulo">' + d.rotulo + "</p>" +
        '<p class="indicador-valor">' + d.valor + (d.unidad ? "<small>" + d.unidad + "</small>" : "") + "</p>" +
        '<p class="indicador-pie">' + d.pie + "</p>" +
        "</div>";
    }).join("");
  }

  /* ---------- serie temporal ---------- */

  function serie() {
    var datos = D.reclamos_serie.slice();
    if (estado.periodo) datos = datos.slice(-estado.periodo);

    var cont = document.getElementById("serie");
    cont.innerHTML = "";

    var W = 1000, H = 230, ml = 52, mr = 16, mt = 16, mb = 30;
    var ax = W - ml - mr, ay = H - mt - mb;

    var max = 0;
    datos.forEach(function (d) { if (d.cantidad > max) max = d.cantidad; });
    var paso = pasoLindo(max, 4);
    var tope = Math.ceil(max / paso) * paso;

    function px(i) { return ml + (datos.length === 1 ? ax / 2 : i / (datos.length - 1) * ax); }
    function py(v) { return mt + ay - v / tope * ay; }

    var svg = el("svg", { viewBox: "0 0 " + W + " " + H, role: "img",
      "aria-label": "Reclamos mensuales por inconvenientes en el suministro, de 2018 a 2026" });

    // grilla y eje vertical, recesivos
    for (var v = 0; v <= tope + 1e-6; v += paso) {
      svg.appendChild(el("line", { class: "grilla", x1: ml, x2: W - mr, y1: py(v), y2: py(v) }));
      svg.appendChild(texto("text", { class: "eje-texto", x: ml - 10, y: py(v) + 3.5, "text-anchor": "end" },
        v === 0 ? "0" : (v / 1000).toLocaleString("es-AR", { maximumFractionDigits: 1 }) + " mil"));
    }

    // area y linea
    var d1 = "", d2 = "";
    datos.forEach(function (d, i) {
      d1 += (i ? "L" : "M") + px(i).toFixed(1) + " " + py(d.cantidad).toFixed(1) + " ";
    });
    d2 = d1 + "L" + px(datos.length - 1).toFixed(1) + " " + py(0) + " L" + px(0).toFixed(1) + " " + py(0) + " Z";

    svg.appendChild(el("path", { class: "serie-area", d: d2 }));
    svg.appendChild(el("path", { class: "serie-linea", d: d1 }));

    // marcas de anio sobre el eje horizontal
    var anioVisto = {};
    datos.forEach(function (d, i) {
      if (d.mes === 1 && !anioVisto[d.anio]) {
        anioVisto[d.anio] = true;
        svg.appendChild(el("line", { class: "eje-linea", x1: px(i), x2: px(i), y1: mt + ay, y2: mt + ay + 5 }));
        svg.appendChild(texto("text", { class: "eje-texto", x: px(i), y: H - 10, "text-anchor": "middle" }, d.anio));
      }
    });

    svg.appendChild(el("line", { class: "eje-linea", x1: ml, x2: W - mr, y1: mt + ay, y2: mt + ay }));

    // etiquetas directas solo en el maximo y en el ultimo punto
    var iMax = 0;
    datos.forEach(function (d, i) { if (d.cantidad > datos[iMax].cantidad) iMax = i; });
    var iFin = datos.length - 1;

    [[iMax, "máximo"], [iFin, "último"]].forEach(function (par) {
      var i = par[0], d = datos[i];
      svg.appendChild(el("circle", { class: "marca-punto", cx: px(i), cy: py(d.cantidad), r: 4.5 }));
      var ancla = i > datos.length * .82 ? "end" : "middle";
      svg.appendChild(texto("text", { class: "marca-rotulo", x: px(i), y: py(d.cantidad) - 16, "text-anchor": ancla },
        num(d.cantidad)));
      svg.appendChild(texto("text", { class: "marca-rotulo-suave", x: px(i), y: py(d.cantidad) - 5, "text-anchor": ancla },
        MESES[d.mes - 1] + " " + d.anio + ", " + par[1]));
    });

    var cruz = el("line", { class: "cruz", x1: 0, x2: 0, y1: mt, y2: mt + ay, opacity: 0 });
    svg.appendChild(cruz);
    var foco = el("circle", { class: "marca-punto", cx: 0, cy: 0, r: 4.5, opacity: 0 });
    svg.appendChild(foco);

    cont.appendChild(svg);

    var globo = document.createElement("div");
    globo.className = "globo";
    cont.appendChild(globo);

    svg.addEventListener("pointermove", function (ev) {
      var caja = svg.getBoundingClientRect();
      var x = (ev.clientX - caja.left) / caja.width * W;
      var i = Math.round((x - ml) / ax * (datos.length - 1));
      if (i < 0 || i >= datos.length) return;

      var d = datos[i];
      cruz.setAttribute("x1", px(i));
      cruz.setAttribute("x2", px(i));
      cruz.setAttribute("opacity", 1);
      foco.setAttribute("cx", px(i));
      foco.setAttribute("cy", py(d.cantidad));
      foco.setAttribute("opacity", 1);

      globo.innerHTML = "<b>" + num(d.cantidad) + "</b> reclamos<br><i>" +
        MESES_LARGOS[d.mes - 1] + " de " + d.anio + "</i>";
      globo.style.left = (px(i) / W * caja.width) + "px";
      globo.style.top = (py(d.cantidad) / H * caja.height) + "px";
      globo.classList.add("visible");
    });

    svg.addEventListener("pointerleave", function () {
      cruz.setAttribute("opacity", 0);
      foco.setAttribute("opacity", 0);
      globo.classList.remove("visible");
    });

    var anios = Object.keys(D.reclamos_por_anio);
    var primero = D.reclamos_por_anio[anios[0]];
    var ultimoCompleto = D.reclamos_por_anio[anios[anios.length - 2]];
    var caida = Math.round((1 - ultimoCompleto / primero) * 100);

    document.getElementById("serie-pie").innerHTML =
      "Son <b>" + num(D.reclamos_total_grupo_ii) + " reclamos</b> de inconvenientes en el suministro entre " +
      anios[0] + " y " + anios[anios.length - 1] + ", con " + anios[anios.length - 1] +
      " todavía incompleto. El volumen anual baja " + caida + " % entre " + anios[0] + " y " +
      anios[anios.length - 2] + ", pero el patrón dentro del año se repite, y ese patrón es el que " +
      "alimenta la probabilidad de falla de cada tramo." +
      '<br><span style="color:var(--tinta-3)">El pico de julio de 2025, con ' +
      num(8181) + " reclamos contra un promedio mensual de " +
      num(D.reclamos_total_grupo_ii / D.reclamos_serie.length) +
      ", es un valor atípico de la fuente. Antes de entrar al modelo hay que verificarlo " +
      "contra el crudo de ENARGAS o recortarlo.</span>";
  }

  /* ---------- estacionalidad ---------- */

  function estacionalidad() {
    var cont = document.getElementById("estacionalidad");
    cont.innerHTML = "";

    var idx = D.estacionalidad;
    var W = 480, H = 210, ml = 34, mr = 8, mt = 14, mb = 26;
    var ax = W - ml - mr, ay = H - mt - mb;

    var vals = Object.keys(idx).map(function (k) { return idx[k]; });
    var max = Math.max.apply(null, vals);
    var min = Math.min.apply(null, vals);
    var delta = Math.max(max - 1, 1 - min) * 1.18;
    var tope = 1 + delta;
    var piso = 1 - delta;

    function py(v) { return mt + ay - (v - piso) / (tope - piso) * ay; }

    var ancho = ax / 12;
    var barra = ancho - 6;

    var svg = el("svg", { viewBox: "0 0 " + W + " " + H, role: "img",
      "aria-label": "Índice de reclamos por mes sobre la serie completa" });

    [piso, tope].forEach(function (v) {
      svg.appendChild(el("line", { class: "grilla", x1: ml, x2: W - mr, y1: py(v), y2: py(v) }));
      svg.appendChild(texto("text", { class: "eje-texto", x: ml - 8, y: py(v) + 3.5, "text-anchor": "end" },
        v.toFixed(2).replace(".", ",")));
    });

    svg.appendChild(texto("text", { class: "eje-texto", x: ml - 8, y: py(1) + 3.5, "text-anchor": "end" }, "1,00"));
    svg.appendChild(el("line", { class: "eje-linea", x1: ml, x2: W - mr, y1: py(1), y2: py(1) }));

    for (var m = 1; m <= 12; m++) {
      var v = idx[m];
      var x = ml + (m - 1) * ancho + 3;
      var arriba = v >= 1;
      var y = arriba ? py(v) : py(1);
      var alto = Math.abs(py(v) - py(1));

      svg.appendChild(el("rect", {
        x: x.toFixed(1), y: y.toFixed(1), width: barra.toFixed(1),
        height: Math.max(2, alto).toFixed(1),
        rx: 3, fill: arriba ? BORDO : FRIO, opacity: .92
      }));

      svg.appendChild(texto("text", {
        class: "eje-texto", x: (x + barra / 2).toFixed(1), y: H - 9, "text-anchor": "middle"
      }, MESES[m - 1]));
    }

    var pico = 1, valle = 1;
    for (var k = 1; k <= 12; k++) {
      if (idx[k] > idx[pico]) pico = k;
      if (idx[k] < idx[valle]) valle = k;
    }

    cont.appendChild(svg);

    cont.insertAdjacentHTML("afterend", "");
    document.getElementById("estacion-lectura").innerHTML =
      '<span class="referencia" style="margin-bottom:10px">' +
        '<span><i style="background:' + BORDO + '"></i>por encima del promedio anual</span>' +
        '<span><i style="background:' + FRIO + '"></i>por debajo</span>' +
      "</span><br>" +
      "El pico está en <b>" + MESES_LARGOS[pico - 1] + "</b>, con un índice de " +
      idx[pico].toFixed(2).replace(".", ",") + ", y el valle en <b>" + MESES_LARGOS[valle - 1] +
      "</b>, con " + idx[valle].toFixed(2).replace(".", ",") +
      ". Entre el mes más cargado y el más tranquilo hay un <b>" +
      Math.round((idx[pico] / idx[valle] - 1) * 100) + " %</b> de diferencia, y es lo que justifica " +
      "adelantar la inspección de los tramos críticos al otoño.";
  }

  /* ---------- ranking ---------- */

  function ranking() {
    var c = D.ciudades[estado.ciudad];
    var filas = c.tramos.slice(0, 8).map(function (t) {
      var vencido = t.dias > 365;
      return "<tr>" +
        '<td><span class="tabla-calle">' + t.nombre + "</span>" +
        '<span class="tabla-sub">' + t.id + ", " + num(t.largo) + " m, " + t.material.toLowerCase() + "</span></td>" +
        '<td class="n"><span class="barrita"><i style="width:' + t.indice + '%"></i></span>' + t.indice.toFixed(0) + "</td>" +
        '<td class="n">' + num(t.hogares) + "</td>" +
        '<td class="n' + (vencido ? " vencido" : "") + '">' + num(t.dias) + " días</td>" +
        "</tr>";
    }).join("");

    document.querySelector("#ranking tbody").innerHTML = filas;
  }

  /* ---------- consulta anclada ---------- */

  function preguntas() {
    var c = D.ciudades[estado.ciudad];
    var criticos = c.tramos.filter(function (t) { return t.score >= 95; });
    var primero = c.tramos[0];

    var riesgoTotal = 0, riesgoCritico = 0;
    c.tramos.forEach(function (t) { riesgoTotal += t.crit; });
    criticos.forEach(function (t) { riesgoCritico += t.crit; });

    var conReceptor = criticos.filter(function (t) { return t.receptores.length > 0; });
    var vencidos = criticos.filter(function (t) { return t.dias > 365; });

    var pico = 1;
    for (var k = 1; k <= 12; k++) if (D.estacionalidad[k] > D.estacionalidad[pico]) pico = k;

    return [
      {
        titulo: "¿Por qué " + primero.nombre + " encabeza la cola?",
        texto: "El tramo <b>" + primero.id + "</b> de " + primero.nombre + " tiene una probabilidad anual de falla de <b>" +
          (primero.prob * 100).toFixed(2).replace(".", ",") + " %</b> y una consecuencia de <b>" +
          num(primero.consecuencia) + " hogares equivalentes</b>. El producto de los dos lo deja primero en la cola de " + c.nombre + ", con un índice de <b>" +
          primero.indice.toFixed(0) + " sobre 100</b>. Lleva <b>" + num(primero.dias) +
          " días</b> sin inspección.",
        citas: [
          ["Probabilidad", "modelo sobre la serie de reclamos de ENARGAS, modulado por material " +
            primero.material.toLowerCase() + " y " + primero.antiguedad + " años de antigüedad", "cálculo"],
          ["Consecuencia", num(primero.hogares) + " hogares aguas abajo por un factor de " +
            primero.factor.toFixed(2).replace(".", ",") + " por receptores sensibles", "cálculo"],
          ["Geometría", primero.nombre + ", " + num(primero.largo) + " metros, OpenStreetMap", "dato real"]
        ]
      },
      {
        titulo: "¿Cuánto riesgo concentran los tramos críticos?",
        texto: "Los <b>" + num(criticos.length) + " tramos críticos</b> son el " +
          (criticos.length / c.tramos.length * 100).toFixed(1).replace(".", ",") +
          " % de la red bajo seguimiento y concentran el <b>" +
          (riesgoCritico / riesgoTotal * 100).toFixed(0) + " %</b> del riesgo total. " +
          "De esos, <b>" + num(conReceptor.length) + "</b> tienen al menos un receptor sensible a menos de 160 metros.",
        citas: [
          ["Umbral", "percentil 95 de criticidad sobre los " + num(c.tramos.length) + " tramos de " + c.nombre, "definición"],
          ["Receptores", num(c.receptores.length) + " escuelas, hospitales, centros de salud y jardines etiquetados en OpenStreetMap", "dato real"]
        ]
      },
      {
        titulo: "¿Cuándo conviene adelantar la inspección?",
        texto: "El índice de reclamos toca su máximo en <b>" + MESES_LARGOS[pico - 1] + "</b>, con " +
          D.estacionalidad[pico].toFixed(2).replace(".", ",") + " contra un promedio de 1,00. " +
          "Programar los <b>" + num(vencidos.length) + " tramos críticos vencidos</b> antes de esa ventana " +
          "es lo que más corre la aguja.",
        citas: [
          ["Estacionalidad", "índice mensual sobre " + num(D.reclamos_total_grupo_ii) +
            " reclamos de inconvenientes en el suministro, 2018 a 2026", "dato real"],
          ["Vencidos", num(vencidos.length) + " de " + num(criticos.length) +
            " tramos críticos superan los 365 días sin inspección", "cálculo"]
        ]
      },
      {
        titulo: "¿Qué no puede responder este sistema?",
        texto: "No puede decir <b>dónde hay una fuga</b>. Malla prioriza dónde ir a buscarla. " +
          "Tampoco puede bajar los reclamos de ENARGAS por debajo de la provincia: el dato viene agregado " +
          "por prestadora, provincia, mes y grupo, sin localidad ni coordenadas. " +
          "Y la traza fina de la red no es pública, así que la capa de tramos se deriva del callejero " +
          "con un supuesto declarado.",
        citas: [
          ["Límite de la fuente", "las columnas publicadas llegan hasta provincia, no hay localidad ni fecha exacta", "verificado"],
          ["Supuesto declarado", "red secundaria sobre calles con frente edificado dentro del área de cobertura", "metodología"]
        ]
      }
    ];
  }

  function consulta() {
    var lista = preguntas();

    document.getElementById("sugerencias").innerHTML = lista.map(function (p, i) {
      return '<button class="sugerencia" type="button" data-p="' + i + '" aria-pressed="false">' +
        p.titulo + "</button>";
    }).join("");

    Array.prototype.forEach.call(document.querySelectorAll("[data-p]"), function (el2) {
      el2.addEventListener("click", function () { responder(+el2.dataset.p, lista); });
    });
  }

  function responder(i, lista) {
    Array.prototype.forEach.call(document.querySelectorAll("[data-p]"), function (el2) {
      el2.setAttribute("aria-pressed", +el2.dataset.p === i ? "true" : "false");
    });

    var caja = document.getElementById("respuesta");
    caja.innerHTML = '<span class="pensando"><i></i><i></i><i></i> Consultando el cálculo</span>';

    setTimeout(function () {
      var p = lista[i];
      caja.innerHTML =
        '<p class="respuesta-texto">' + p.texto + "</p>" +
        '<div class="citas">' + p.citas.map(function (c) {
          return '<div class="cita"><b>' + c[0] + "</b><span>" + c[1] + "</span><em>" + c[2] + "</em></div>";
        }).join("") + "</div>";
    }, 420);
  }

  /* ---------- arranque ---------- */

  function refrescar() {
    indicadores();
    serie();
    estacionalidad();
    ranking();
    consulta();
  }

  function iniciar() {
    var sel = document.getElementById("ciudad");
    Object.keys(D.ciudades).forEach(function (k) {
      var o = document.createElement("option");
      o.value = k;
      o.textContent = D.ciudades[k].nombre;
      sel.appendChild(o);
    });
    sel.value = estado.ciudad;
    sel.addEventListener("change", function () { estado.ciudad = sel.value; refrescar(); });

    var per = document.getElementById("periodo");
    per.addEventListener("change", function () { estado.periodo = +per.value; serie(); });

    document.getElementById("btn-procedencia").addEventListener("click", function () {
      document.querySelector(".pie").scrollIntoView({ behavior: "smooth", block: "end" });
    });

    refrescar();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", iniciar);
  else iniciar();
})();
