'use client'

import { useEffect, useState } from 'react'
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react'
import { adminService } from '@/services/admin.service'
import { MediaPicker } from '@/components/admin/media-picker'
import { Alert, Button, Field, Input, Select, SkeletonRows, Textarea } from '@/components/ui'
import { useAuth } from '@/hooks/use-auth'
import type { AdminCategory } from '@/types/api'

/**
 * Homepage content editor.
 *
 * The homepage is composed from the `home.sections` setting, so this screen
 * edits that JSON through a form rather than exposing a textarea of JSON. Order
 * here is render order on the storefront.
 *
 * Not a drag-and-drop page builder — just the fields, plus move up/down.
 */

type Section =
  | { type: 'hero'; image: string; eyebrow: string; heading: string; body: string; ctaLabel: string; ctaHref: string }
  | { type: 'services'; items: Array<{ title: string; body: string }> }
  | { type: 'featured-products'; heading: string; limit: number }
  | { type: 'new-arrivals'; heading: string; limit: number; first?: string[] }
  | { type: 'banner'; image: string; eyebrow: string; heading: string; body: string; ctaLabel: string; ctaHref: string }
  | { type: 'category-banner'; heading: string; slugs: string[] }
  | {
      type: 'film-band'
      video: string
      poster: string
      heading?: string
      body?: string
      ctaLabel?: string
      ctaHref?: string
    }
  | {
      type: 'video-grid'
      eyebrow: string
      heading: string
      items: Array<{ video: string; poster: string; label: string; href: string }>
    }
  | { type: 'showcase'; heading: string; body: string; limit: number; href?: string; linkLabel?: string }
  | { type: 'newsletter'; heading: string; body: string }

const SECTION_LABELS: Record<Section['type'], string> = {
  hero: 'Hero',
  services: 'Service bar',
  'featured-products': 'Featured products',
  'new-arrivals': 'New arrivals',
  banner: 'Editorial banner',
  'category-banner': 'Shop by category',
  'video-grid': 'Film wall',
  'film-band': 'Feature film',
  showcase: 'Customer showcase',
  newsletter: 'Newsletter',
}

function blankSection(type: Section['type'], categories: AdminCategory[]): Section {
  switch (type) {
    case 'hero':
      return { type, image: '', eyebrow: '', heading: 'New heading', body: '', ctaLabel: 'Shop now', ctaHref: '/products' }
    case 'banner':
      return { type, image: '', eyebrow: '', heading: 'New banner', body: '', ctaLabel: 'Explore', ctaHref: '/products' }
    case 'services':
      return { type, items: [{ title: 'Made to order', body: 'Cut and finished for you.' }] }
    case 'featured-products':
      return { type, heading: 'Featured', limit: 4 }
    case 'new-arrivals':
      return { type, heading: 'New Arrivals', limit: 8 }
    case 'category-banner':
      return { type, heading: 'Shop by category', slugs: categories.filter((c) => c.parent).slice(0, 5).map((c) => c.slug) }
    case 'film-band':
      return { type, video: '', poster: '', heading: '', body: '', ctaLabel: '', ctaHref: '' }
    case 'video-grid':
      // Four is what the row is designed around; the grid is four across on
      // desktop and two on mobile, so any other count leaves a gap.
      return {
        type,
        eyebrow: '',
        heading: 'New collection',
        items: Array.from({ length: 4 }, () => ({ video: '', poster: '', label: '', href: '/products' })),
      }
    case 'showcase':
      return { type, heading: 'Follow us', body: '', limit: 8 }
    case 'newsletter':
      return { type, heading: 'Subscribe to our newsletter', body: 'Early access to new collections.' }
  }
}

export default function AdminContentPage() {
  const { can } = useAuth()
  const [sections, setSections] = useState<Section[]>([])
  const [categories, setCategories] = useState<AdminCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [adding, setAdding] = useState<Section['type']>('banner')

  const readOnly = !can('settings.update')

  useEffect(() => {
    void (async () => {
      try {
        const [rows, cats] = await Promise.all([
          adminService.settings(),
          adminService.categories().catch(() => []),
        ])
        setCategories(cats)

        const raw = rows.find((s) => s.key === 'home.sections')?.value
        setSections(raw ? (JSON.parse(raw) as Section[]) : [])
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not load the homepage content')
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  function patch(index: number, changes: Partial<Section>) {
    setSections((prev) => prev.map((s, i) => (i === index ? ({ ...s, ...changes } as Section) : s)))
    setSaved(false)
  }

  function move(index: number, direction: -1 | 1) {
    const target = index + direction
    if (target < 0 || target >= sections.length) return
    setSections((prev) => {
      const next = [...prev]
      ;[next[index], next[target]] = [next[target]!, next[index]!]
      return next
    })
    setSaved(false)
  }

  async function save() {
    setSaving(true)
    setError(null)
    setSaved(false)
    try {
      await adminService.updateSettings([
        { key: 'home.sections', value: JSON.stringify(sections) },
      ])
      setSaved(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <SkeletonRows rows={6} />

  return (
    <div className="mx-auto max-w-3xl">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="display text-2xl">Homepage content</h1>
          <p className="mt-1 text-sm text-ink-soft">
            Sections render in this order. Changes go live as soon as you save.
          </p>
        </div>
        {!readOnly && (
          <Button loading={saving} onClick={() => void save()}>
            Save changes
          </Button>
        )}
      </header>

      {error && <Alert>{error}</Alert>}
      {saved && (
        <div className="mb-5">
          <Alert tone="success">Saved. Reload the storefront to see it.</Alert>
        </div>
      )}

      <div className="space-y-5">
        {sections.map((section, index) => (
          <section key={`${section.type}-${index}`} className="border border-rule bg-white">
            <header className="flex items-center justify-between gap-3 border-b border-rule px-5 py-3">
              <div className="flex items-center gap-3">
                <span className="label-caps">{SECTION_LABELS[section.type] ?? section.type}</span>
                <span className="text-xs text-ink-soft">#{index + 1}</span>
              </div>

              {!readOnly && (
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => move(index, -1)}
                    disabled={index === 0}
                    aria-label="Move up"
                    className="p-1.5 text-ink-soft hover:text-ink disabled:opacity-30"
                  >
                    <ArrowUp className="size-3.5" strokeWidth={1.6} />
                  </button>
                  <button
                    type="button"
                    onClick={() => move(index, 1)}
                    disabled={index === sections.length - 1}
                    aria-label="Move down"
                    className="p-1.5 text-ink-soft hover:text-ink disabled:opacity-30"
                  >
                    <ArrowDown className="size-3.5" strokeWidth={1.6} />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSections((prev) => prev.filter((_, i) => i !== index))
                      setSaved(false)
                    }}
                    aria-label="Remove section"
                    className="p-1.5 text-ink-soft hover:text-danger"
                  >
                    <Trash2 className="size-3.5" strokeWidth={1.6} />
                  </button>
                </div>
              )}
            </header>

            <div className="space-y-4 p-5">
              <SectionFields
                section={section}
                categories={categories}
                readOnly={readOnly}
                onChange={(changes) => patch(index, changes)}
              />
            </div>
          </section>
        ))}
      </div>

      {!readOnly && (
        <div className="mt-6 flex items-end gap-3 border border-dashed border-rule p-5">
          <Field label="Add a section" htmlFor="add-type">
            <Select
              id="add-type"
              value={adding}
              onChange={(e) => setAdding(e.target.value as Section['type'])}
            >
              {Object.entries(SECTION_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </Field>
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              setSections((prev) => [...prev, blankSection(adding, categories)])
              setSaved(false)
            }}
          >
            <Plus className="size-3.5" strokeWidth={2} />
            Add
          </Button>
        </div>
      )}

      {!readOnly && (
        <div className="mt-6 flex justify-end">
          <Button loading={saving} onClick={() => void save()}>
            Save changes
          </Button>
        </div>
      )}
    </div>
  )
}

function SectionFields({
  section,
  categories,
  readOnly,
  onChange,
}: {
  section: Section
  categories: AdminCategory[]
  readOnly: boolean
  onChange: (changes: Partial<Section>) => void
}) {
  switch (section.type) {
    case 'hero':
    case 'banner':
      return (
        <>
          <MediaPicker
            value={section.image}
            onChange={(image) => onChange({ image } as Partial<Section>)}
            folder={section.type === 'hero' ? 'home' : 'banners'}
            label={section.type === 'hero' ? 'Background image or video' : 'Banner image or video'}
            hint={
              section.type === 'hero'
                ? 'Video plays muted and looping behind the text. Landscape works best.'
                : 'Shown beside the text. JPEG, PNG, WebP, AVIF, MP4 or WebM.'
            }
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Eyebrow" htmlFor="eyebrow" hint="Small line above the heading.">
              <Input
                value={section.eyebrow}
                disabled={readOnly}
                onChange={(e) => onChange({ eyebrow: e.target.value } as Partial<Section>)}
              />
            </Field>
            <Field label="Heading" htmlFor="heading">
              <Input
                value={section.heading}
                disabled={readOnly}
                onChange={(e) => onChange({ heading: e.target.value } as Partial<Section>)}
              />
            </Field>
          </div>

          <Field label="Body" htmlFor="body">
            <Textarea
              rows={2}
              value={section.body}
              disabled={readOnly}
              onChange={(e) => onChange({ body: e.target.value } as Partial<Section>)}
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Button label" htmlFor="ctaLabel">
              <Input
                value={section.ctaLabel}
                disabled={readOnly}
                onChange={(e) => onChange({ ctaLabel: e.target.value } as Partial<Section>)}
              />
            </Field>
            <Field label="Button link" htmlFor="ctaHref" hint="A path on this site, e.g. /products">
              <Input
                value={section.ctaHref}
                disabled={readOnly}
                onChange={(e) => onChange({ ctaHref: e.target.value } as Partial<Section>)}
              />
            </Field>
          </div>
        </>
      )

    case 'services':
      return (
        <>
          {section.items.map((item, i) => (
            <div key={i} className="grid gap-3 sm:grid-cols-[1fr_2fr_auto]">
              <Input
                value={item.title}
                disabled={readOnly}
                aria-label={`Service ${i + 1} title`}
                onChange={(e) =>
                  onChange({
                    items: section.items.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)),
                  } as Partial<Section>)
                }
              />
              <Input
                value={item.body}
                disabled={readOnly}
                aria-label={`Service ${i + 1} text`}
                onChange={(e) =>
                  onChange({
                    items: section.items.map((x, j) => (j === i ? { ...x, body: e.target.value } : x)),
                  } as Partial<Section>)
                }
              />
              {!readOnly && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => onChange({ items: section.items.filter((_, j) => j !== i) } as Partial<Section>)}
                >
                  Remove
                </Button>
              )}
            </div>
          ))}
          {!readOnly && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onChange({ items: [...section.items, { title: '', body: '' }] } as Partial<Section>)}
            >
              Add item
            </Button>
          )}
        </>
      )

    case 'featured-products':
    case 'new-arrivals':
      return (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Heading" htmlFor="heading">
            <Input
              value={section.heading}
              disabled={readOnly}
              onChange={(e) => onChange({ heading: e.target.value } as Partial<Section>)}
            />
          </Field>
          <Field label="How many products" htmlFor="limit" hint="The grid is four across.">
            <Input
              type="number"
              min={1}
              max={24}
              value={section.limit}
              disabled={readOnly}
              onChange={(e) => onChange({ limit: Number(e.target.value) || 4 } as Partial<Section>)}
            />
          </Field>

          {section.type === 'new-arrivals' && (
            <div className="sm:col-span-2">
              <Field
                label="Show these first"
                htmlFor="first"
                hint="Product web addresses, comma separated — look-54, look-41. They lead the row in this order; the rest follows newest first. A piece listed here is not repeated below. Leave empty for newest first throughout."
              >
                <Input
                  value={(section.first ?? []).join(', ')}
                  disabled={readOnly}
                  placeholder="look-54, look-41, look-11"
                  onChange={(e) =>
                    onChange({
                      first: e.target.value
                        .split(',')
                        .map((slug) => slug.trim())
                        .filter(Boolean),
                    } as Partial<Section>)
                  }
                />
              </Field>
            </div>
          )}
        </div>
      )

    case 'category-banner':
      return (
        <>
          <Field label="Heading" htmlFor="heading">
            <Input
              value={section.heading}
              disabled={readOnly}
              onChange={(e) => onChange({ heading: e.target.value } as Partial<Section>)}
            />
          </Field>
          <div>
            <span className="field-label">Categories shown</span>
            <div className="flex flex-wrap gap-2">
              {categories
                .filter((c) => c.parent)
                .map((c) => {
                  const on = section.slugs.includes(c.slug)
                  return (
                    <button
                      key={c.id}
                      type="button"
                      disabled={readOnly}
                      onClick={() =>
                        onChange({
                          slugs: on
                            ? section.slugs.filter((s) => s !== c.slug)
                            : [...section.slugs, c.slug],
                        } as Partial<Section>)
                      }
                      className={`border px-3 py-1.5 text-xs transition-colors ${
                        on ? 'border-sage-700 bg-sage-700 text-white' : 'border-rule hover:border-ink'
                      }`}
                    >
                      {c.name}
                    </button>
                  )
                })}
            </div>
            <p className="field-hint">Each tile uses that category&rsquo;s image.</p>
          </div>
        </>
      )

    case 'film-band':
      return (
        <>
          <p className="mb-3 text-xs text-ink-soft">
            One film across the full width, shown in the shape it was shot — it is not cropped to
            a tall frame like the film wall. Keep it under about 6 MB; it only downloads once a
            visitor scrolls near it.
          </p>

          <div className="grid gap-4 sm:grid-cols-2">
            <MediaPicker
              value={section.video}
              label="Film"
              folder="home"
              hint="A web-sized MP4. A camera master will load for minutes."
              onChange={(video) => onChange({ video } as Partial<Section>)}
            />
            <MediaPicker
              value={section.poster}
              label="Poster"
              folder="home"
              hint="Shown before the film plays, and what sets the height. Use a still from the film itself."
              onChange={(poster) => onChange({ poster } as Partial<Section>)}
            />
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field label="Heading" htmlFor="fb-heading" hint="Optional. Shown under the film.">
              <Input
                value={section.heading ?? ''}
                disabled={readOnly}
                onChange={(e) => onChange({ heading: e.target.value } as Partial<Section>)}
              />
            </Field>
            <Field label="Link reads as" htmlFor="fb-cta" hint='e.g. "Shop the collection".'>
              <Input
                value={section.ctaLabel ?? ''}
                disabled={readOnly}
                onChange={(e) => onChange({ ctaLabel: e.target.value } as Partial<Section>)}
              />
            </Field>
          </div>

          <div className="mt-4">
            <Field label="Body" htmlFor="fb-body" hint="Optional.">
              <Textarea
                rows={2}
                value={section.body ?? ''}
                disabled={readOnly}
                onChange={(e) => onChange({ body: e.target.value } as Partial<Section>)}
              />
            </Field>
          </div>

          <div className="mt-4">
            <Field label="Link goes to" htmlFor="fb-href" hint="A path on this site, e.g. /products">
              <Input
                value={section.ctaHref ?? ''}
                disabled={readOnly}
                placeholder="/products"
                onChange={(e) => onChange({ ctaHref: e.target.value } as Partial<Section>)}
              />
            </Field>
          </div>
        </>
      )

    case 'video-grid':
      return (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Eyebrow" htmlFor="eyebrow" hint="Small line above the title.">
              <Input
                value={section.eyebrow}
                disabled={readOnly}
                onChange={(e) => onChange({ eyebrow: e.target.value } as Partial<Section>)}
              />
            </Field>
            <Field label="Title" htmlFor="heading" hint="Sits over the films, centred.">
              <Input
                value={section.heading}
                disabled={readOnly}
                onChange={(e) => onChange({ heading: e.target.value } as Partial<Section>)}
              />
            </Field>
          </div>

          <p className="mt-5 text-xs text-ink-soft">
            Each film plays when someone hovers it, and shows its poster until then. The poster is
            not optional — it is what a phone shows before the film is tapped, and what someone who
            has asked for reduced motion sees instead of movement.
          </p>

          <div className="mt-3 space-y-4">
            {section.items.map((item, i) => (
              <div key={i} className="border border-rule p-4">
                <p className="label-caps mb-3 text-xs">Film {i + 1}</p>

                <div className="grid gap-4 sm:grid-cols-2">
                  <MediaPicker
                    value={item.video}
                    label="Film"
                    folder="home"
                    hint="A web-sized MP4. A camera master will load for minutes."
                    onChange={(video) =>
                      onChange({
                        items: section.items.map((x, j) => (j === i ? { ...x, video } : x)),
                      } as Partial<Section>)
                    }
                  />
                  <MediaPicker
                    value={item.poster}
                    label="Poster"
                    folder="home"
                    hint="Shown before the film plays."
                    onChange={(poster) =>
                      onChange({
                        items: section.items.map((x, j) => (j === i ? { ...x, poster } : x)),
                      } as Partial<Section>)
                    }
                  />

                  <Field label="Caption" htmlFor={`vg-label-${i}`} hint="Shown on hover. Also the link's description for screen readers.">
                    <Input
                      value={item.label}
                      disabled={readOnly}
                      onChange={(e) =>
                        onChange({
                          items: section.items.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)),
                        } as Partial<Section>)
                      }
                    />
                  </Field>

                  <Field label="Links to" htmlFor={`vg-href-${i}`}>
                    <Input
                      value={item.href}
                      placeholder="/products"
                      disabled={readOnly}
                      onChange={(e) =>
                        onChange({
                          items: section.items.map((x, j) => (j === i ? { ...x, href: e.target.value } : x)),
                        } as Partial<Section>)
                      }
                    />
                  </Field>
                </div>
              </div>
            ))}
          </div>

          {!readOnly && (
            <div className="mt-4 flex gap-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={() =>
                  onChange({
                    items: [...section.items, { video: '', poster: '', label: '', href: '/products' }],
                  } as Partial<Section>)
                }
              >
                Add a film
              </Button>
              {section.items.length > 1 && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => onChange({ items: section.items.slice(0, -1) } as Partial<Section>)}
                >
                  Remove the last
                </Button>
              )}
            </div>
          )}
        </>
      )

    case 'showcase':
      return (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Heading" htmlFor="heading">
              <Input
                value={section.heading}
                disabled={readOnly}
                onChange={(e) => onChange({ heading: e.target.value } as Partial<Section>)}
              />
            </Field>
            <Field label="How many" htmlFor="limit" hint="Tiles to show. The rest stay in Showcase.">
              <Input
                type="number"
                min={1}
                max={24}
                value={section.limit}
                disabled={readOnly}
                onChange={(e) => onChange({ limit: Number(e.target.value || 8) } as Partial<Section>)}
              />
            </Field>
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field
              label="Link to"
              htmlFor="href"
              hint="An outside address, e.g. your Instagram. Opens in a new tab. Leave empty for no link."
            >
              <Input
                value={section.href ?? ''}
                disabled={readOnly}
                placeholder="https://www.instagram.com/…"
                onChange={(e) => onChange({ href: e.target.value } as Partial<Section>)}
              />
            </Field>
            <Field label="Link reads as" htmlFor="linkLabel" hint='Defaults to "Follow us".'>
              <Input
                value={section.linkLabel ?? ''}
                disabled={readOnly}
                placeholder="@prashandki"
                onChange={(e) => onChange({ linkLabel: e.target.value } as Partial<Section>)}
              />
            </Field>
          </div>

          <div className="mt-4">
            <Field label="Body" htmlFor="body">
              <Textarea
                rows={2}
                value={section.body}
                disabled={readOnly}
                onChange={(e) => onChange({ body: e.target.value } as Partial<Section>)}
              />
            </Field>
          </div>

          <p className="mt-3 text-xs text-ink-soft">
            The tiles themselves are managed in Storefront &rarr; Showcase, where each one records
            the customer&rsquo;s permission before it can be published.
          </p>
        </>
      )

    case 'newsletter':
      return (
        <>
          <Field label="Heading" htmlFor="heading">
            <Input
              value={section.heading}
              disabled={readOnly}
              onChange={(e) => onChange({ heading: e.target.value } as Partial<Section>)}
            />
          </Field>
          <Field label="Body" htmlFor="body">
            <Input
              value={section.body}
              disabled={readOnly}
              onChange={(e) => onChange({ body: e.target.value } as Partial<Section>)}
            />
          </Field>
          <p className="text-xs text-ink-soft">
            The footer already shows a newsletter form on every page — adding one here as well
            means the homepage shows two.
          </p>
        </>
      )
  }
}
