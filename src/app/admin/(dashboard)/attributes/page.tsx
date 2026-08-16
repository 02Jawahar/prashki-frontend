'use client'

import { useCallback, useEffect, useState } from 'react'
import { Plus, X } from 'lucide-react'
import { useAuth } from '@/hooks/use-auth'
import { attributeService, type Attribute } from '@/services/admin-modules.service'
import { ApiRequestError } from '@/services/api-client'
import {
  Alert,
  Button,
  ConfirmDialog,
  EmptyState,
  Field,
  Input,
  SkeletonRows,
} from '@/components/ui'

/**
 * Product options (M12).
 *
 * These are the values the storefront's filter panel is built from. A value in
 * use cannot be deleted — the API refuses, because removing it would silently
 * drop the variants carrying it out of every filtered result.
 */
export default function AdminAttributesPage() {
  const { can } = useAuth()
  const editable = can('attribute.manage')

  const [attributes, setAttributes] = useState<Attribute[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [newIsSwatch, setNewIsSwatch] = useState(false)

  const [valueDrafts, setValueDrafts] = useState<Record<string, { value: string; colorHex: string }>>({})
  const [deleting, setDeleting] = useState<
    { kind: 'attribute' | 'value'; id: string; name: string } | null
  >(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setAttributes(await attributeService.list())
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load options')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function run(action: () => Promise<unknown>) {
    setBusy(true)
    setError(null)
    try {
      await action()
      await load()
      setDeleting(null)
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'That did not work')
    } finally {
      setBusy(false)
    }
  }

  async function addValue(attribute: Attribute) {
    const draft = valueDrafts[attribute.id]
    if (!draft?.value.trim()) return

    await run(async () => {
      await attributeService.addValue(attribute.id, {
        value: draft.value.trim(),
        colorHex: attribute.isSwatch ? draft.colorHex || null : null,
      })
      setValueDrafts((current) => ({ ...current, [attribute.id]: { value: '', colorHex: '' } }))
    })
  }

  return (
    <div className="mx-auto max-w-4xl">
      <header className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="display text-2xl">Product options</h1>
          <p className="mt-1 text-sm text-ink-soft">
            Sizes, colours and anything else customers filter by. Assign them to variants from the
            product page.
          </p>
        </div>
        {editable && (
          <Button size="sm" onClick={() => setCreating(true)}>
            <Plus className="size-3.5" strokeWidth={2} />
            New option
          </Button>
        )}
      </header>

      {error && <Alert>{error}</Alert>}

      {creating && (
        <div className="mb-5 border border-rule bg-white p-5">
          <h2 className="display mb-4 text-lg">New option</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Name" htmlFor="attr-name" required hint="e.g. Size, Colour, Fabric">
              <Input
                id="attr-name"
                value={newName}
                onChange={(event) => setNewName(event.target.value)}
              />
            </Field>
            <div className="flex items-end pb-1">
              <label className="flex cursor-pointer items-center gap-2.5 text-sm">
                <input
                  type="checkbox"
                  className="size-4 accent-[#5b6241]"
                  checked={newIsSwatch}
                  onChange={(event) => setNewIsSwatch(event.target.checked)}
                />
                Show as colour swatches
              </label>
            </div>
          </div>

          <div className="mt-4 flex gap-3">
            <Button
              size="sm"
              loading={busy}
              disabled={!newName.trim()}
              onClick={() =>
                void run(async () => {
                  await attributeService.create({
                    name: newName.trim(),
                    isSwatch: newIsSwatch,
                    isFilterable: true,
                  })
                  setCreating(false)
                  setNewName('')
                  setNewIsSwatch(false)
                })
              }
            >
              Create
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setCreating(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {loading ? (
        <SkeletonRows rows={3} />
      ) : attributes.length === 0 ? (
        <div className="border border-rule bg-white p-5">
          <EmptyState
            title="No options yet"
            body="Create one — Size is usually the first — then add its values."
          />
        </div>
      ) : (
        <div className="space-y-5">
          {attributes.map((attribute) => (
            <section key={attribute.id} className="border border-rule bg-white">
              <header className="flex flex-wrap items-center justify-between gap-3 border-b border-rule p-5">
                <div>
                  <h2 className="display text-lg">{attribute.name}</h2>
                  <p className="mt-0.5 text-xs text-ink-soft">
                    /{attribute.slug}
                    {attribute.isSwatch ? ' · swatches' : ''}
                    {attribute.isFilterable ? ' · shown in filters' : ' · hidden from filters'}
                  </p>
                </div>

                {editable && (
                  <div className="flex items-center gap-3">
                    <label className="flex cursor-pointer items-center gap-2 text-xs">
                      <input
                        type="checkbox"
                        className="size-3.5 accent-[#5b6241]"
                        checked={attribute.isFilterable}
                        onChange={(event) =>
                          void run(() =>
                            attributeService.update(attribute.id, {
                              isFilterable: event.target.checked,
                            }),
                          )
                        }
                      />
                      Filterable
                    </label>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        setDeleting({ kind: 'attribute', id: attribute.id, name: attribute.name })
                      }
                    >
                      Delete
                    </Button>
                  </div>
                )}
              </header>

              <div className="p-5">
                {attribute.values.length === 0 ? (
                  <p className="text-sm text-ink-soft">No values yet.</p>
                ) : (
                  <ul className="flex flex-wrap gap-2">
                    {attribute.values.map((value) => (
                      <li
                        key={value.id}
                        className="flex items-center gap-2 border border-rule px-3 py-1.5 text-sm"
                      >
                        {value.colorHex && (
                          <span
                            className="size-3.5 rounded-full border border-rule"
                            style={{ backgroundColor: value.colorHex }}
                            aria-hidden
                          />
                        )}
                        {value.value}
                        <span className="text-xs text-ink-soft">({value.usageCount})</span>
                        {editable && (
                          <button
                            type="button"
                            aria-label={`Delete ${value.value}`}
                            onClick={() =>
                              setDeleting({ kind: 'value', id: value.id, name: value.value })
                            }
                            className="text-ink-soft hover:text-danger"
                          >
                            <X className="size-3" strokeWidth={1.8} />
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                )}

                {editable && (
                  <div className="mt-4 flex flex-wrap items-end gap-3">
                    <div className="w-40">
                      <Field label="Add a value" htmlFor={`v-${attribute.id}`}>
                        <Input
                          id={`v-${attribute.id}`}
                          value={valueDrafts[attribute.id]?.value ?? ''}
                          onChange={(event) =>
                            setValueDrafts((current) => ({
                              ...current,
                              [attribute.id]: {
                                value: event.target.value,
                                colorHex: current[attribute.id]?.colorHex ?? '',
                              },
                            }))
                          }
                          placeholder={attribute.isSwatch ? 'Sage' : 'XXL'}
                        />
                      </Field>
                    </div>

                    {attribute.isSwatch && (
                      <div className="w-32">
                        <Field label="Colour" htmlFor={`c-${attribute.id}`}>
                          <Input
                            id={`c-${attribute.id}`}
                            type="color"
                            value={valueDrafts[attribute.id]?.colorHex || '#838e5e'}
                            onChange={(event) =>
                              setValueDrafts((current) => ({
                                ...current,
                                [attribute.id]: {
                                  value: current[attribute.id]?.value ?? '',
                                  colorHex: event.target.value,
                                },
                              }))
                            }
                          />
                        </Field>
                      </div>
                    )}

                    <Button
                      size="sm"
                      variant="outline"
                      loading={busy}
                      onClick={() => void addValue(attribute)}
                    >
                      Add
                    </Button>
                  </div>
                )}
              </div>
            </section>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={deleting !== null}
        title={`Delete ${deleting?.name}?`}
        body="If anything is using it, the deletion will be refused rather than silently breaking those products."
        confirmLabel="Delete"
        loading={busy}
        onConfirm={() => {
          if (!deleting) return
          void run(() =>
            deleting.kind === 'attribute'
              ? attributeService.remove(deleting.id)
              : attributeService.removeValue(deleting.id),
          )
        }}
        onCancel={() => setDeleting(null)}
      />
    </div>
  )
}
