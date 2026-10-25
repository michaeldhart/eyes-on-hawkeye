---
description: "Search the full text of every public record we have about Belvidere's proposed data center."
layout: default
title: Search
title_es: Buscar
description_es: "Busque en el texto completo de todos los registros públicos que tenemos sobre el centro de datos propuesto en Belvidere."
i18n: true
scripts: [https://cdnjs.cloudflare.com/ajax/libs/lunr.js/2.3.9/lunr.min.js, /assets/js/search.js]
---
<h1>{{ 'search_h1' | t }}</h1>
<p class="lede">{{ 'search_lede' | t }}</p>
<form id="search-form" role="search">
  <input id="q" type="search" placeholder="{{ 'search_ph' | t | escape }}" autocomplete="off" aria-label="{{ 'nav_search' | t }}">
</form>
<p id="status" class="muted" aria-live="polite"></p>
<ol id="results" class="results"></ol>
