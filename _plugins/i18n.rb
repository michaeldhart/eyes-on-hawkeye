# frozen_string_literal: true

# Spanish version of the site.
#
# English pages live at /, Spanish at /es/. Documents, people and the "i18n: true" pages
# (document index, people index, timeline, search and the two JSON feeds) are cloned under
# /es/ at build time with lang: es. Any front matter key ending in _es (title_es,
# summary_es, role_es, ...) replaces its English twin on the cloned page. Pages with a lot
# of prose (home, about, contact) are written by hand in es/.
#
# Liquid helpers, all keyed off the lang of the page being rendered:
#   {{ 'nav_documents' | t }}        UI string from _data/i18n/<lang>.yml (English if missing)
#   {{ d | tx: 'title' }}            d.title_es on Spanish pages, falling back to d.title
#   {{ d.url | loc | relative_url }} prefixes /es on Spanish pages
#   {{ d.date | fdate: 'long' }}     "May 26, 2026" / "26 de mayo de 2026" (also 'short')
#   {{ tag | tag_t }}                tag display name (_data/i18n/tags_es.yml)
#   {{ s | en_quotes }}              marks quoted English as lang="en" in Spanish text (see below)
#   {{ nil | i18n_strings | jsonify }}  all UI strings, for assets/js

module HawkeyeI18n
  MONTHS = {
    'en' => { long: %w[January February March April May June July August September October November December],
              short: %w[Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec] },
    'es' => { long: %w[enero febrero marzo abril mayo junio julio agosto septiembre octubre noviembre diciembre],
              short: %w[ene feb mar abr may jun jul ago sep oct nov dic] }
  }.freeze
  FORMATS = {
    'long' => { 'en' => '%B %-d, %Y', 'es' => '%-d de %B de %Y' },
    'short' => { 'en' => '%b %-d, %Y', 'es' => '%-d %b %Y' }
  }.freeze

  module Filters
    def t(key, a = nil, b = nil)
      i18n = @context.registers[:site].data['i18n']
      s = i18n.dig(lang_now, key)
      if s.nil?
        s = i18n.dig('en', key)
        Jekyll.logger.warn 'i18n:', "missing #{lang_now} string '#{key}'" if lang_now != 'en'
      end
      s = key if s.nil?
      s.to_s.gsub('%1', a.to_s).gsub('%2', b.to_s)
    end

    def tx(item, field)
      return item[field] unless lang_now == 'es'

      v = item["#{field}_es"]
      v.nil? || v.to_s.strip.empty? ? item[field] : v
    end

    def loc(url)
      return url unless lang_now == 'es' && url.to_s.start_with?('/') && !url.to_s.start_with?('/es/')

      "/es#{url}"
    end

    def fdate(input, style = 'long')
      return '' if input.nil? || input.to_s.empty?

      time = input.respond_to?(:strftime) ? input : Time.parse(input.to_s)
      fmt = FORMATS.dig(style, lang_now) || style
      m = time.month - 1
      fmt = fmt.gsub('%B', MONTHS[lang_now][:long][m]).gsub('%b', MONTHS[lang_now][:short][m])
      time.strftime(fmt)
    end

    def tag_t(tag)
      return tag unless lang_now == 'es'

      @context.registers[:site].data.dig('i18n', 'tags_es', tag) || tag
    end

    # Spanish summaries keep quotes from the records in English, followed by the translation in
    # parentheses: “enthusiastic interest” (“interés entusiasta”). Mark the English part for screen readers.
    def en_quotes(text)
      return text unless lang_now == 'es' && text

      text.to_s.gsub(/“([^”]+)”(?= \(“)/, '<span lang="en">“\\1”</span>')
    end

    def i18n_strings(_ignored = nil)
      i18n = @context.registers[:site].data['i18n']
      (i18n['en'] || {}).merge(i18n[lang_now] || {})
    end

    private

    def lang_now
      (@context.registers[:page] || {})['lang'] || 'en'
    end
  end

  class Generator < Jekyll::Generator
    safe true
    priority :low

    LAYOUTS = { 'documents' => 'document', 'people' => 'person' }.freeze

    def generate(site)
      clones = []
      LAYOUTS.each do |label, layout|
        coll = site.collections[label] or next
        coll.docs.each { |doc| clones << clone_doc(site, doc, layout) }
      end
      site.pages.select { |p| p.data['i18n'] }.each { |page| clones << clone_page(site, page) }
      site.pages.concat(clones)
    end

    private

    def clone_doc(site, doc, layout)
      dir = File.join('es', doc.url.sub(%r{\A/}, ''))
      page = Jekyll::PageWithoutAFile.new(site, site.source, dir, 'index.md')
      page.content = doc.content
      page.data.merge!(doc.data)
      page.data['slug'] ||= doc.basename_without_ext
      page.data['layout'] ||= layout
      page.data['permalink'] = "/#{dir}/"
      localize!(page.data)
      page
    end

    def clone_page(site, src)
      src_dir = File.dirname(src.relative_path).sub(/\A\.\z/, '')
      page = Jekyll::PageWithoutAFile.new(site, site.source, File.join('es', src_dir), src.name)
      page.content = src.content
      page.data.merge!(src.data)
      page.data.delete('i18n')
      page.data['permalink'] = "/es#{src.data['permalink']}" if src.data['permalink']
      localize!(page.data)
      page
    end

    def localize!(data)
      data.keys.grep(/_es\z/).each do |k|
        v = data[k]
        data[k.delete_suffix('_es')] = v unless v.nil? || v.to_s.strip.empty?
      end
      data['lang'] = 'es'
    end
  end
end

Liquid::Template.register_filter(HawkeyeI18n::Filters)
