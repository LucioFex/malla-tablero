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

  var estado = { ciudad: "bahia_blanca", periodo: 0, pregunta: null, jornadas: 10 };

  var MOTOR = window.MALLA_MOTOR;
  var TOPE = 40;          // jornadas que abarca el eje de la curva
  var planes = {};        // el plan de cada ciudad, calculado una sola vez

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

    var km = 0;
    c.tramos.forEach(function (t) { km += t.largo; });
    /* Los hogares aguas abajo de dos tramos se superponen, asi que no se suman. Se muestra
       el corte mas grave, que es un solo calculo sobre el grafo. */
    var peor = c.tramos.reduce(function (a, t) { return t.hogares > a.hogares ? t : a; });

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
        rotulo: "Corte más grave",
        valor: num(peor.hogares),
        unidad: "hogares",
        pie: "quedan sin gas si sale de servicio " + peor.nombre + ". Es la cifra que hoy nadie calcula."
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
    var tendencia = Math.abs(caida) < 5
      ? "El volumen anual se mantiene estable entre " + anios[0] + " y " + anios[anios.length - 2]
      : "El volumen anual baja " + caida + " % entre " + anios[0] + " y " + anios[anios.length - 2];

    /* el pico sale de la serie y no de un numero escrito a mano, para que no se
       desincronice cuando se regeneran los datos */
    var pico = D.reclamos_serie[0];
    D.reclamos_serie.forEach(function (m) { if (m.cantidad > pico.cantidad) pico = m; });

    document.getElementById("serie-pie").innerHTML =
      "Son <b>" + num(D.reclamos_total_grupo_ii) + " reclamos</b> de inconvenientes en el suministro entre " +
      anios[0] + " y " + anios[anios.length - 1] + ", con " + anios[anios.length - 1] +
      " todavía incompleto. " + tendencia + ", y el patrón dentro del año se repite. " +
      "Una regresión entrenada sobre esta serie hasta 2024 pronostica <b>" + num(D.carga.reclamos) +
      " reclamos</b> para " + MESES_LARGOS[D.carga.mes - 1] + " de " + D.carga.anio + ", un factor de <b>" +
      D.carga.factor.toFixed(2).replace(".", ",") + "</b> sobre el promedio de los últimos doce meses. " +
      "El factor multiplica la probabilidad de todos los tramos por igual: cambia su valor, no el orden de la cola." +
      '<br><span style="color:var(--tinta-3)">El pico de ' + MESES_LARGOS[pico.mes - 1] +
      " de " + pico.anio + ", con " + num(pico.cantidad) + " reclamos contra un promedio mensual de " +
      num(D.reclamos_total_grupo_ii / D.reclamos_serie.length) +
      ", es un valor atípico de la fuente. El modelo no lo borra: como entrada lo reemplaza por la mediana " +
      "de los doce meses anteriores, y su error se informa con él y sin él.</span>";
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

  /* ---------- curva de cobertura ---------- */
  /* Cuanta cuadrilla hace falta para cubrir cuanto riesgo. Es la lectura de gestion del
     mismo calculo que el visor muestra tramo por tramo, y es de donde sale el numero con el
     que se escribe un objetivo medible en lugar de un adjetivo. */

  /* La curva no se estima aparte: se le pide al mismo motor que arma la hoja de ruta
     del dia, con una cuadrilla por jornada asignada. Como cada jornada solo agrega
     tramos y no cambia lo que hicieron las anteriores, una sola corrida da la curva
     entera, y el punto de dos jornadas es exactamente la recorrida que dibuja la hoja
     de ruta con dos cuadrillas. */

  function plan() {
    if (!planes[estado.ciudad]) {
      planes[estado.ciudad] = MOTOR.planificar(D.ciudades[estado.ciudad], TOPE, 8);
    }
    return planes[estado.ciudad];
  }

  function puntos(acumulado, riesgoTotal) {
    var serie = [{ j: 0, pct: 0 }];
    for (var i = 0; i < acumulado.length; i++) {
      serie.push({ j: i + 1, pct: acumulado[i] / riesgoTotal * 100 });
    }
    return serie;
  }

  function enJornadas(serie, j) {
    return serie[Math.min(j, serie.length - 1)].pct;
  }

  function curva() {
    var c = D.ciudades[estado.ciudad];
    var p = plan();
    var riesgoTotal = p.riesgoTotal;

    var malla = puntos(p.malla.acumulado, riesgoTotal);
    var actual = puntos(p.actual.acumulado, riesgoTotal);

    var cont = document.getElementById("curva");
    cont.innerHTML = "";

    var W = 1000, H = 250, ml = 52, mr = 16, mt = 16, mb = 34;
    var ax = W - ml - mr, ay = H - mt - mb;

    function px(j) { return ml + j / TOPE * ax; }
    function py(p) { return mt + ay - p / 100 * ay; }

    var svg = el("svg", { viewBox: "0 0 " + W + " " + H, role: "img",
      "aria-label": "Riesgo cubierto segun jornadas de cuadrilla asignadas por semana" });

    for (var v = 0; v <= 100; v += 25) {
      svg.appendChild(el("line", { class: "grilla", x1: ml, x2: W - mr, y1: py(v), y2: py(v) }));
      svg.appendChild(texto("text", { class: "eje-texto", x: ml - 10, y: py(v) + 3.5, "text-anchor": "end" },
        v + " %"));
    }

    for (var j = 0; j <= TOPE; j += 10) {
      svg.appendChild(el("line", { class: "eje-linea", x1: px(j), x2: px(j), y1: mt + ay, y2: mt + ay + 5 }));
      svg.appendChild(texto("text", { class: "eje-texto", x: px(j), y: H - 14, "text-anchor": "middle" },
        j === 0 ? "0" : j + " jornadas"));
    }

    svg.appendChild(el("line", { class: "eje-linea", x1: ml, x2: W - mr, y1: mt + ay, y2: mt + ay }));

    function trazo(puntos) {
      var d = "";
      puntos.forEach(function (p, i) {
        d += (i ? "L" : "M") + px(p.j).toFixed(1) + " " + py(p.pct).toFixed(1) + " ";
      });
      return d;
    }

    var dMalla = trazo(malla);
    svg.appendChild(el("path", { class: "curva-area",
      d: dMalla + "L" + px(malla[malla.length - 1].j).toFixed(1) + " " + py(0) + " L" + px(0) + " " + py(0) + " Z" }));
    svg.appendChild(el("path", { class: "curva-actual", d: trazo(actual) }));
    svg.appendChild(el("path", { class: "curva-linea", d: dMalla }));

    // el punto elegido, sobre las dos curvas
    var jn = estado.jornadas;
    var pm = enJornadas(malla, jn);
    var pa = enJornadas(actual, jn);

    svg.appendChild(el("line", { class: "curva-guia", x1: px(jn), x2: px(jn), y1: mt, y2: mt + ay }));
    svg.appendChild(el("circle", { class: "marca-punto", cx: px(jn), cy: py(pm), r: 4.5 }));
    svg.appendChild(el("circle", { cx: px(jn), cy: py(pa), r: 4, fill: FRIO, stroke: "#fbfaf8", "stroke-width": 2 }));

    var ancla = jn > TOPE * .8 ? "end" : "start";
    var dx = jn > TOPE * .8 ? -10 : 10;
    svg.appendChild(texto("text", { class: "marca-rotulo", x: px(jn) + dx, y: py(pm) - 15, "text-anchor": ancla },
      pm.toFixed(0) + " % con Malla"));
    svg.appendChild(texto("text", { class: "marca-rotulo-suave", x: px(jn) + dx, y: py(pa) + 17, "text-anchor": ancla },
      pa.toFixed(1).replace(".", ",") + " % por calle"));

    cont.appendChild(svg);

    var veces = pa > 0 ? pm / pa : 0;

    document.getElementById("curva-lectura").innerHTML =
      '<span class="referencia" style="margin-bottom:10px">' +
        '<span><i style="background:' + BORDO + '"></i>recorrida por criticidad</span>' +
        '<span><i style="background:' + FRIO + '"></i>lista por calle, el criterio de hoy</span>' +
      "</span><br>" +
      "Con <b>" + jn + (jn === 1 ? " jornada" : " jornadas") + " de ocho horas por semana</b> la recorrida por " +
      "criticidad cubre el <b>" + pm.toFixed(0) + " %</b> del riesgo de la red de " + c.nombre +
      ", contra el <b>" + pa.toFixed(1).replace(".", ",") + " %</b> que cubre la lista por calle con el " +
      "mismo esfuerzo. Son <b>" + veces.toFixed(1).replace(".", ",") +
      " veces</b> más riesgo cubierto sin agregar una sola hora de cuadrilla. La ventaja " +
      "es mayor cuanto más escaso es el recurso, que es la situación real: con la red " +
      "entera recorrida los dos criterios llegan al mismo lugar.";
  }

  /* ---------- consulta anclada ----------

     Cada consulta permitida devuelve su respuesta armada y sus citas. La voz le pasa al
     modelo esa misma respuesta como datos, y solo acepta la redaccion si no agrega ningun
     numero. Sin modelo, o si la redaccion no pasa, se muestra la armada. */

  var ETIQUETAS = [
    ["corte", "qué queda sin gas, cuántos hogares o receptores se afectan si se corta un tramo"],
    ["encabeza", "por qué un tramo encabeza la cola o es el más crítico"],
    ["cobertura", "cuánto riesgo cubren tantas jornadas u horas de cuadrilla"],
    ["concentracion", "cuánto riesgo concentran los tramos críticos"],
    ["adelantar", "cuándo conviene adelantar la inspección"],
    ["limites", "qué no puede responder el sistema, o cualquier otra pregunta"]
  ];

  function coma(x, d) { return x.toFixed(d).replace(".", ","); }

  function peorCorte(c) {
    return c.tramos.reduce(function (a, t) { return t.hogares > a.hogares ? t : a; });
  }

  /* El tramo por su identificador o por el nombre de la calle. Con varios tramos en la
     misma calle se toma el que deja mas hogares sin gas. Si no nombra ninguno, el peor. */
  function buscarTramo(pregunta, c) {
    var id = /\bT\d{5}\b/i.exec(pregunta);
    if (id) {
      var t = c.tramos.filter(function (x) { return x.id === id[0].toUpperCase(); })[0];
      if (t) return t;
    }
    var p = pregunta.toLowerCase(), mejor = null, largo = 0;
    c.tramos.forEach(function (x) {
      var n = x.nombre.toLowerCase();
      if (n.length > 3 && p.indexOf(n) !== -1 &&
          (n.length > largo || (n.length === largo && x.hogares > mejor.hogares))) {
        mejor = x; largo = n.length;
      }
    });
    return mejor || peorCorte(c);
  }

  function buscarJornadas(pregunta) {
    var m = /(\d+)\s*(jornada|cuadrilla|d[ií]a)/i.exec(pregunta);
    var j = m ? parseInt(m[1], 10) : estado.jornadas;
    return Math.max(1, Math.min(TOPE, j));
  }

  function consultas(param) {
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

    var peor = peorCorte(c);
    var corte = param.tramo || peor;
    var rec = corte.receptores;
    var jn = param.jornadas || estado.jornadas;
    var p = plan();
    var pm = enJornadas(puntos(p.malla.acumulado, p.riesgoTotal), jn);
    var pa = enJornadas(puntos(p.actual.acumulado, p.riesgoTotal), jn);

    return {
      corte: {
        titulo: "¿Qué queda sin gas si se corta " + corte.nombre + "?",
        texto: "Si se corta el tramo <b>" + corte.id + "</b> de " + corte.nombre + " quedan sin gas <b>" +
          num(corte.hogares) + " hogares</b> aguas abajo" +
          (rec.length
            ? ", y dependen de él <b>" + num(rec.length) + (rec.length === 1 ? " receptor sensible" : " receptores sensibles") +
              "</b>, entre ellos " + rec.slice(0, 3).map(function (r) { return r.nombre; }).join(", ") + "."
            : ". No depende de él ningún receptor sensible.") +
          (corte === peor ? " Es el corte más grave de " + c.nombre + "." : ""),
        citas: [
          ["Hogares", "calculados sobre el grafo de la red modelada radial, con los hogares del Censo 2022", "cálculo"],
          ["Entrada de gas", "el punto más cercano al gasoducto troncal de ENARGAS, que no es la entrada real", "supuesto"]
        ]
      },
      encabeza: {
        titulo: "¿Por qué " + primero.nombre + " encabeza la cola?",
        texto: "El tramo <b>" + primero.id + "</b> de " + primero.nombre + " tiene una probabilidad de falla de <b>" +
          coma(primero.prob * 100, 2) + " %</b> y una consecuencia de <b>" +
          num(primero.consecuencia) + " hogares equivalentes</b>. El producto de los dos lo deja primero en la cola de " + c.nombre + ", con un índice de <b>" +
          primero.indice.toFixed(0) + " sobre 100</b>. Lleva <b>" + num(primero.dias) +
          " días</b> sin inspección.",
        citas: [
          ["Probabilidad", "base por material " + primero.material.toLowerCase() + " y " + primero.antiguedad +
            " años de antigüedad, que no son dato público, por el factor de carga " +
            coma(D.carga.factor, 2) + " que pronostica el modelo sobre la serie de reclamos de ENARGAS",
            "muestra y modelo"],
          ["Consecuencia", num(primero.hogares) + " hogares aguas abajo por un factor de " +
            coma(primero.factor, 2) + " por receptores sensibles", "cálculo"],
          ["Geometría", primero.nombre + ", " + num(primero.largo) + " metros, OpenStreetMap", "dato real"]
        ]
      },
      cobertura: {
        titulo: "¿Cuánto riesgo cubren " + jn + (jn === 1 ? " jornada?" : " jornadas?"),
        texto: "Con <b>" + jn + (jn === 1 ? " jornada" : " jornadas") + "</b> de ocho horas por semana la recorrida por " +
          "criticidad cubre el <b>" + coma(pm, 1) + " %</b> del riesgo de la red de " + c.nombre +
          ", contra el <b>" + coma(pa, 1) + " %</b> que cubre la lista por calle con las mismas horas." +
          (pa > 0 ? " Son <b>" + coma(pm / pa, 1) + " veces</b> más riesgo cubierto." : ""),
        citas: [
          ["Motor", "el mismo que arma la hoja de ruta del día, con una cuadrilla por jornada", "cálculo"],
          ["Lista por calle", "orden alfabético recorrido de arriba hacia abajo, el criterio de hoy", "definición"]
        ]
      },
      concentracion: {
        titulo: "¿Cuánto riesgo concentran los tramos críticos?",
        texto: "Los <b>" + num(criticos.length) + " tramos críticos</b> son el " +
          coma(criticos.length / c.tramos.length * 100, 1) +
          " % de la red bajo seguimiento y concentran el <b>" +
          (riesgoCritico / riesgoTotal * 100).toFixed(0) + " %</b> del riesgo total. " +
          "De esos, <b>" + num(conReceptor.length) + "</b> tienen al menos un receptor sensible aguas abajo.",
        citas: [
          ["Umbral", "percentil 95 de criticidad sobre los " + num(c.tramos.length) + " tramos de " + c.nombre, "definición"],
          ["Receptores", num(c.receptores.length) + " escuelas, hospitales, centros de salud y jardines etiquetados en OpenStreetMap", "dato real"]
        ]
      },
      adelantar: {
        titulo: "¿Cuándo conviene adelantar la inspección?",
        texto: "El índice de reclamos toca su máximo en <b>" + MESES_LARGOS[pico - 1] + "</b>, con " +
          coma(D.estacionalidad[pico], 2) + " contra un promedio de 1,00. " +
          "Programar los <b>" + num(vencidos.length) + " tramos críticos vencidos</b> antes de esa ventana " +
          "es lo que más corre la aguja.",
        citas: [
          ["Estacionalidad", "índice mensual sobre " + num(D.reclamos_total_grupo_ii) +
            " reclamos de inconvenientes en el suministro, 2018 a 2026", "dato real"],
          ["Vencidos", num(vencidos.length) + " de " + num(criticos.length) +
            " tramos críticos superan los 365 días sin inspección", "cálculo"]
        ]
      },
      limites: {
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
    };
  }

  var ORDEN = ["corte", "encabeza", "cobertura", "concentracion", "adelantar", "limites"];

  function consulta() {
    var lista = consultas({});

    document.getElementById("sugerencias").innerHTML = ORDEN.map(function (k) {
      return '<button class="sugerencia" type="button" data-p="' + k + '" aria-pressed="false">' +
        lista[k].titulo + "</button>";
    }).join("");

    Array.prototype.forEach.call(document.querySelectorAll("[data-p]"), function (el2) {
      el2.addEventListener("click", function () {
        marcar(el2.dataset.p);
        mostrar(lista[el2.dataset.p], null);
      });
    });
  }

  function marcar(k) {
    Array.prototype.forEach.call(document.querySelectorAll("[data-p]"), function (el2) {
      el2.setAttribute("aria-pressed", el2.dataset.p === k ? "true" : "false");
    });
  }

  function escapar(s) {
    return s.replace(/[&<>"]/g, function (ch) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;" }[ch];
    });
  }

  function citasHtml(q) {
    return '<div class="citas">' + q.citas.map(function (c) {
      return '<div class="cita"><b>' + c[0] + "</b><span>" + c[1] + "</span><em>" + c[2] + "</em></div>";
    }).join("") + "</div>";
  }

  /* texto es la redaccion validada del modelo. Si es null se muestra la armada. */
  function mostrar(q, texto, nota) {
    document.getElementById("respuesta").innerHTML =
      (nota ? '<p class="voz-nota">' + escapar(nota) + "</p>" : "") +
      '<p class="respuesta-texto">' + (texto === null ? q.texto : escapar(texto)) + "</p>" +
      (texto === null ? "" : '<p class="voz-nota">Lo que devolvió el cálculo: ' + q.texto + "</p>") +
      citasHtml(q);
  }

  function datosDe(q) {
    return q.texto.replace(/<[^>]+>/g, "");
  }

  /* los numeros clave son los que la respuesta armada pone en negrita */
  function clavesDe(q) {
    var r = [];
    (q.texto.match(/<b>[\s\S]*?<\/b>/g) || []).forEach(function (b) {
      r = r.concat(VOZ.numeros(b.replace(/<[^>]+>/g, "")));
    });
    return r;
  }

  var VOZ = window.MallaVoz;

  async function preguntar(pregunta) {
    var c = D.ciudades[estado.ciudad];
    var param = { tramo: buscarTramo(pregunta, c), jornadas: buscarJornadas(pregunta) };
    var lista = consultas(param);
    var caja = document.getElementById("respuesta");
    marcar(null);

    if (!VOZ.lista()) {
      var k0 = VOZ.clasificarPorClaves(pregunta);
      mostrar(lista[k0], null, "Consulta elegida por palabras clave: " + lista[k0].titulo +
        " Respuesta armada, sin modelo de lenguaje.");
      return;
    }

    caja.innerHTML = '<p class="pensando">El modelo elige la consulta</p>';
    var t0 = performance.now();
    try {
      var porClaves = VOZ.clasificarPorClaves(pregunta);
      var k = await VOZ.elegir(pregunta, ETIQUETAS) || porClaves;
      // limites es la etiqueta de descarte: si las palabras clave encuentran otra, gana esa
      if (k === "limites" && porClaves !== "limites") k = porClaves;
      var q = lista[k];
      if (k === "limites") {
        // no tiene numeros que validar y el modelo la puede tergiversar, va siempre armada
        mostrar(q, null, "Consulta: " + q.titulo + " Respuesta armada, sin redacción del modelo.");
        if (window.console) console.log("[voz]", k, "armada");
        return;
      }
      caja.innerHTML = '<p class="pensando">' + escapar(q.titulo) + " El modelo redacta con esos números</p>";
      var hechos = datosDe(q);
      var borrador = await VOZ.redactar(pregunta, hechos);
      var v = VOZ.validar(borrador, VOZ.numeros(hechos).map(function (n) { return n.valor; }));
      var f = VOZ.completo(borrador, clavesDe(q));
      var s = coma((performance.now() - t0) / 1000, 1);
      if (v.ok && !f.ok) {
        mostrar(q, null, "Consulta: " + q.titulo + " La redacción del modelo dejaba afuera un número " +
          "de la consulta, así que se muestra la respuesta armada.");
      } else if (v.ok) {
        mostrar(q, borrador, "Consulta: " + q.titulo + " Redactado por el modelo en este navegador y " +
          "validado contra el cálculo, en " + s + " s.");
      } else {
        mostrar(q, null, "Consulta: " + q.titulo + " La redacción del modelo traía un número que el " +
          "sistema no calculó, así que se muestra la respuesta armada.");
      }
      if (window.console) console.log("[voz]", k, s + " s", !v.ok ? "sobra un número" :
        (!f.ok ? "falta un número" : "valida"), borrador);
    } catch (e) {
      var k1 = VOZ.clasificarPorClaves(pregunta);
      mostrar(lista[k1], null, "El modelo falló, se muestra la respuesta armada.");
      if (window.console) console.log("[voz] error", e);
    }
  }

  function voz() {
    var estadoVoz = document.getElementById("voz-estado");
    var boton = document.getElementById("voz-activar");

    document.getElementById("voz-form").addEventListener("submit", function (ev) {
      ev.preventDefault();
      var p = document.getElementById("voz-pregunta").value.trim();
      if (p) preguntar(p);
    });

    if (!VOZ.hayWebGPU()) {
      boton.hidden = true;
      estadoVoz.textContent = "Este navegador no tiene WebGPU, así que la pregunta libre se responde " +
        "con la consulta armada que corresponda. Con Chrome o Edge actualizados se puede activar el modelo.";
      return;
    }

    boton.addEventListener("click", async function () {
      var rotulo = boton.textContent;
      // aviso inmediato: los primeros segundos bajan la libreria y el tokenizador sin progreso
      boton.disabled = true;
      boton.textContent = "Preparando el modelo";
      estadoVoz.textContent = "La primera vez baja alrededor de 1 GB y puede tardar unos minutos. " +
        "Después queda guardado en este navegador y carga en segundos.";
      try {
        var m = await VOZ.cargar(function (p) {
          if (p > 0) boton.textContent = "Cargando el modelo, " + Math.round(p * 100) + " %";
        });
        boton.hidden = true;
        estadoVoz.textContent = "Modelo " + m + " activo en este navegador, sin servidor.";
      } catch (e) {
        boton.textContent = rotulo;
        boton.disabled = false;
        estadoVoz.textContent = "No se pudo cargar el modelo: " + e.message +
          ". La pregunta libre sigue respondiendo con la consulta armada.";
      }
    });
  }

  /* ---------- arranque ---------- */

  function refrescar() {
    indicadores();
    serie();
    estacionalidad();
    curva();
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

    var jor = document.getElementById("jornadas");
    jor.addEventListener("input", function () {
      estado.jornadas = +jor.value;
      document.getElementById("jornadas-valor").textContent = estado.jornadas;
      curva();
    });

    document.getElementById("btn-procedencia").addEventListener("click", function () {
      document.querySelector(".pie").scrollIntoView({ behavior: "smooth", block: "end" });
    });

    refrescar();
    voz();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", iniciar);
  else iniciar();
})();
