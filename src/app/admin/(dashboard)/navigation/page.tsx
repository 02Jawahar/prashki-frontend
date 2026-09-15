'use client'

import { useCallback, useEffect, useState } from 'react'
import { ChevronDown, ChevronUp, Plus, Trash2 } from 'lucide-react'
import { useAuth } from '@/hooks/use-auth'
import { navigationService, type NavNode } from '@/services/admin-modules.service'
import { ApiRequestError } from '@/services/api-client'
import { Alert, Button, EmptyState, Field, Input, SkeletonRows } from '@/components/ui'

/**
 * The main menu (M25).
 *
 * The menu was the one piece of storefront content with no editor at all: it
 * lives in a JSON setting, and the Settings screen filters JSON out on purpose,
 * so changing a link meant a deploy.
 *
 * Four levels, which is what the header draws — a top-level item, the columns
 * under it, the groups inside a column, and the links in each group. The whole
 * tree is saved at once rather than per-row, because a menu is read as a shape:
 * moving an item between columns is one edit to a person and would be three
 * requests to a row-at-a-time API, with a half-applied menu live on the
 * storefront in between.
 */
const MAX_DEPTH = 4

/** Where a node sits in the tree, e.g. [0, 2] = third child of the first item. */
type Path = number[]

function update(items: NavNode[], path: Path, fn: (node: NavNode) => NavNode | null): NavNode[] {
  const [head, ...rest] = path
  return items.flatMap((node, index) => {
    if (index !== head) return [node]
    if (rest.length === 0) {
      const next = fn(node)
      return next ? [next] : []
    }
    return [{ ...node, children: update(node.children ?? [], rest, fn) }]
  })
}

function move(items: NavNode[], path: Path, delta: number): NavNode[] {
  const parentPath = path.slice(0, -1)
  const index = path[path.length - 1]!

  const shift = (list: NavNode[]): NavNode[] => {
    const target = index + delta
    if (target < 0 || target >= list.length) return list
    const next = [...list]
    const [lifted] = next.splice(index, 1)
    next.splice(target, 0, lifted!)
    return next
  }

  if (parentPath.length === 0) return shift(items)
  return update(items, parentPath, (node) => ({ ...node, children: shift(node.children ?? []) }))
}

export default function AdminNavigationPage() {
  const { can } = useAuth()
  const editable = can('settings.update')

  const [items, setItems] = useState<NavNode[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const result = await navigationService.get()
      setItems(result.items)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load the menu')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  function edit(path: Path, fn: (node: NavNode) => NavNode | null) {
    setSaved(false)
    setItems((current) => update(current, path, fn))
  }

  async function save() {
    if (saving) return
    setSaving(true)
    setError(null)

    try {
      setItems(await navigationService.save(items))
      setSaved(true)
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Could not save the menu')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <header className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="display text-2xl">Navigation</h1>
          <p className="mt-1 text-sm text-ink-soft">
            The menu across the top of the storefront. Order here is order on the page.
          </p>
          <p className="mt-1 text-xs text-ink-soft">
            Four levels: a menu item, the columns in its dropdown, the groups inside a column,
            and the links in each group. Links are paths on this site, like <code>/products</code>.
          </p>
        </div>
        {editable && (
          <Button size="sm" onClick={() => setItems((c) => [...c, { label: 'New item', href: '/' }])}>
            <Plus className="size-3.5" strokeWidth={2} />
            Menu item
          </Button>
        )}
      </header>

      {error && <Alert>{error}</Alert>}
      {saved && (
        <div className="mb-5">
          <Alert tone="success">Menu saved. The storefront picks it up on the next page load.</Alert>
        </div>
      )}

      {loading ? (
        <SkeletonRows rows={4} />
      ) : items.length === 0 ? (
        <EmptyState
          title="No menu yet"
          body="Add a menu item to start. Without one the storefront header shows only the wordmark."
        />
      ) : (
        <div className="space-y-3">
          {items.map((node, index) => (
            <Row
              key={index}
              node={node}
              path={[index]}
              depth={1}
              siblings={items.length}
              editable={editable}
              onEdit={edit}
              onMove={(path, delta) => {
                setSaved(false)
                setItems((current) => move(current, path, delta))
              }}
            />
          ))}
        </div>
      )}

      {editable && items.length > 0 && (
        <div className="mt-6">
          <Button onClick={save} loading={saving}>
            Save menu
          </Button>
        </div>
      )}
    </div>
  )
}

function Row({
  node,
  path,
  depth,
  siblings,
  editable,
  onEdit,
  onMove,
}: {
  node: NavNode
  path: Path
  depth: number
  siblings: number
  editable: boolean
  onEdit: (path: Path, fn: (node: NavNode) => NavNode | null) => void
  onMove: (path: Path, delta: number) => void
}) {
  const index = path[path.length - 1]!
  const children = node.children ?? []

  return (
    <div className={`border border-rule bg-white p-4 ${depth > 1 ? 'border-l-2 border-l-sage-300' : ''}`}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={
            depth === 1 ? 'Menu item' : depth === 2 ? 'Column' : depth === 3 ? 'Group' : 'Link'
          } htmlFor={`l-${path.join('-')}`}>
          <Input
            id={`l-${path.join('-')}`}
            value={node.label}
            disabled={!editable}
            onChange={(e) => onEdit(path, (n) => ({ ...n, label: e.target.value }))}
          />
        </Field>

        <Field label="Goes to" htmlFor={`h-${path.join('-')}`}>
          <Input
            id={`h-${path.join('-')}`}
            value={node.href}
            placeholder="/products"
            disabled={!editable}
            onChange={(e) => onEdit(path, (n) => ({ ...n, href: e.target.value }))}
          />
        </Field>
      </div>

      {editable && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {/*
            A heading is still a link to its own landing page, so every level
            can take children until the header runs out of room to draw them.
          */}
          {depth < MAX_DEPTH && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() =>
                onEdit(path, (n) => ({
                  ...n,
                  children: [...(n.children ?? []), { label: 'New link', href: '/' }],
                }))
              }
            >
              <Plus className="size-3.5" strokeWidth={2} />
              {depth === 1 ? 'Add column' : depth === 2 ? 'Add group' : 'Add link'}
            </Button>
          )}

          <Button size="sm" variant="ghost" disabled={index === 0} onClick={() => onMove(path, -1)}>
            <ChevronUp className="size-3.5" strokeWidth={2} />
            <span className="sr-only">Move up</span>
          </Button>

          <Button
            size="sm"
            variant="ghost"
            disabled={index === siblings - 1}
            onClick={() => onMove(path, 1)}
          >
            <ChevronDown className="size-3.5" strokeWidth={2} />
            <span className="sr-only">Move down</span>
          </Button>

          <Button size="sm" variant="ghost" onClick={() => onEdit(path, () => null)}>
            <Trash2 className="size-3.5" strokeWidth={1.6} />
            <span className="sr-only">Remove</span>
          </Button>

          {children.length > 0 && (
            <span className="text-xs text-ink-soft">
              {children.length} {depth === 1 ? 'column' : depth === 2 ? 'group' : 'link'}
              {children.length === 1 ? '' : 's'}
            </span>
          )}
        </div>
      )}

      {children.length > 0 && (
        <div className="mt-3 space-y-3 pl-4">
          {children.map((child, childIndex) => (
            <Row
              key={childIndex}
              node={child}
              path={[...path, childIndex]}
              depth={depth + 1}
              siblings={children.length}
              editable={editable}
              onEdit={onEdit}
              onMove={onMove}
            />
          ))}
        </div>
      )}
    </div>
  )
}
