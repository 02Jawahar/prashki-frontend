'use client'

import { useCallback, useEffect, useState } from 'react'
import { Plus, Lock } from 'lucide-react'
import {
  rbacService,
  type PermissionRow,
  type Role,
} from '@/services/admin-modules.service'
import { ApiRequestError } from '@/services/api-client'
import { useAuth } from '@/hooks/use-auth'
import {
  Alert,
  Button,
  ConfirmDialog,
  Field,
  Input,
  SkeletonRows,
  Textarea,
} from '@/components/ui'

/**
 * Role administration (FR-24.1).
 *
 * The permission matrix is the whole point: an admin can see exactly what each
 * role confers and change it, without a deploy. Permissions themselves are not
 * editable here — they are the vocabulary the API is written against, so
 * inventing one at runtime would create a key nothing checks.
 *
 * Two rules the server enforces and this screen explains rather than hides:
 * you cannot grant what you do not hold, and Super Admin always holds
 * everything.
 */
export default function AdminRolesPage() {
  const { can } = useAuth()
  const editable = can('role.manage')

  const [roles, setRoles] = useState<Role[]>([])
  const [groups, setGroups] = useState<Array<{ group: string; permissions: PermissionRow[] }>>([])
  const [mine, setMine] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const [editing, setEditing] = useState<Role | 'new' | null>(null)
  const [deleting, setDeleting] = useState<Role | null>(null)
  const [busy, setBusy] = useState(false)

  const { user } = useAuth()

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [roleList, catalogue] = await Promise.all([
        rbacService.roles(),
        rbacService.permissions(),
      ])
      setRoles(roleList)
      setGroups(catalogue.groups)
      setMine(new Set(user?.permissions ?? []))
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load roles')
    } finally {
      setLoading(false)
    }
  }, [user?.permissions])

  useEffect(() => {
    void load()
  }, [load])

  async function remove() {
    if (!deleting) return

    setBusy(true)
    try {
      await rbacService.deleteRole(deleting.id)
      setNotice(`${deleting.name} deleted.`)
      setDeleting(null)
      await load()
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Could not delete that role')
      setDeleting(null)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="display text-2xl">Roles</h1>
          <p className="mt-1 text-sm text-ink-soft">
            What each role may do. Changes take effect on the next request — nobody has to sign out
            and back in.
          </p>
        </div>
        {editable && (
          <Button size="sm" onClick={() => setEditing('new')}>
            <Plus className="size-3.5" strokeWidth={2} />
            New role
          </Button>
        )}
      </header>

      {error && <Alert>{error}</Alert>}
      {notice && <Alert tone="info">{notice}</Alert>}

      {editing && (
        <RoleForm
          role={editing === 'new' ? undefined : editing}
          groups={groups}
          grantable={mine}
          onDone={async (message) => {
            setEditing(null)
            setNotice(message)
            await load()
          }}
          onCancel={() => setEditing(null)}
        />
      )}

      {loading ? (
        <SkeletonRows rows={5} className="mt-5" />
      ) : (
        <div className="mt-5 space-y-4">
          {roles.map((role) => (
            <section key={role.id} className="border border-rule bg-white p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="display flex items-center gap-2 text-lg">
                    {role.name}
                    {role.isLocked && (
                      <span
                        className="inline-flex items-center gap-1 text-xs text-ink-soft"
                        title="Super Admin always holds every permission"
                      >
                        <Lock className="size-3" strokeWidth={1.8} aria-hidden />
                        locked
                      </span>
                    )}
                    {role.isSystem && !role.isLocked && (
                      <span className="badge badge-neutral">Built in</span>
                    )}
                  </h2>
                  {role.description && (
                    <p className="mt-1 text-sm text-ink-soft">{role.description}</p>
                  )}
                  <p className="mt-1 text-xs text-ink-soft">
                    {role.permissions.length} permissions · {role.userCount}{' '}
                    {role.userCount === 1 ? 'person' : 'people'}
                  </p>
                </div>

                {editable && !role.isLocked && (
                  <div className="flex gap-2">
                    <Button size="sm" variant="ghost" onClick={() => setEditing(role)}>
                      Edit
                    </Button>
                    {!role.isSystem && (
                      <Button size="sm" variant="ghost" onClick={() => setDeleting(role)}>
                        Delete
                      </Button>
                    )}
                  </div>
                )}
              </div>

              <ul className="mt-4 flex flex-wrap gap-1.5">
                {role.permissions.slice(0, 40).map((key) => (
                  <li
                    key={key}
                    className="border border-hairline px-2 py-0.5 font-mono text-[0.68rem] text-ink-soft"
                  >
                    {key}
                  </li>
                ))}
                {role.permissions.length > 40 && (
                  <li className="px-2 py-0.5 text-[0.68rem] text-ink-soft">
                    +{role.permissions.length - 40} more
                  </li>
                )}
              </ul>
            </section>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={deleting !== null}
        title={`Delete ${deleting?.name}?`}
        body="Anyone holding it loses those permissions immediately. If the role is still assigned, the deletion is refused."
        confirmLabel="Delete"
        loading={busy}
        onConfirm={() => void remove()}
        onCancel={() => setDeleting(null)}
      />
    </div>
  )
}

function RoleForm({
  role,
  groups,
  grantable,
  onDone,
  onCancel,
}: {
  role?: Role
  groups: Array<{ group: string; permissions: PermissionRow[] }>
  /** What the signed-in admin holds — you cannot grant beyond this. */
  grantable: Set<string>
  onDone: (message: string) => void | Promise<void>
  onCancel: () => void
}) {
  const [name, setName] = useState(role?.name ?? '')
  const [description, setDescription] = useState(role?.description ?? '')
  const [selected, setSelected] = useState<Set<string>>(new Set(role?.permissions ?? []))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const toggle = (key: string) =>
    setSelected((current) => {
      const next = new Set(current)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })

  const toggleGroup = (permissions: PermissionRow[], on: boolean) =>
    setSelected((current) => {
      const next = new Set(current)
      for (const permission of permissions) {
        if (!grantable.has(permission.key)) continue
        if (on) next.add(permission.key)
        else next.delete(permission.key)
      }
      return next
    })

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (saving) return

    setSaving(true)
    setError(null)

    const payload = {
      name,
      description: description || null,
      permissions: [...selected],
    }

    try {
      if (role) {
        await rbacService.updateRole(role.id, payload)
        await onDone(`${name} updated.`)
      } else {
        await rbacService.createRole(payload)
        await onDone(`${name} created.`)
      }
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Could not save that role')
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} className="border border-rule bg-white p-6" noValidate>
      <h2 className="display mb-5 text-lg">{role ? `Edit ${role.name}` : 'New role'}</h2>

      {error && <Alert>{error}</Alert>}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name" htmlFor="role-name" required>
          <Input
            id="role-name"
            required
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Fulfilment Assistant"
          />
        </Field>

        <Field label="Description" htmlFor="role-desc" hint="What this role is for.">
          <Input
            id="role-desc"
            maxLength={300}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
        </Field>
      </div>

      <div className="mt-6">
        <p className="field-label">Permissions</p>
        <p className="mb-4 text-xs text-ink-soft">
          Greyed-out permissions are ones you do not hold yourself — you cannot grant those. Every
          one of these is re-checked on the server for every request.
        </p>

        <div className="space-y-5">
          {groups.map(({ group, permissions }) => {
            const available = permissions.filter((p) => grantable.has(p.key))
            const allOn = available.length > 0 && available.every((p) => selected.has(p.key))

            return (
              <fieldset key={group} className="border border-hairline p-4">
                <legend className="flex items-center gap-3 px-1">
                  <span className="label-caps">{group}</span>
                  {available.length > 0 && (
                    <button
                      type="button"
                      onClick={() => toggleGroup(permissions, !allOn)}
                      className="text-[0.68rem] text-sage-700 underline"
                    >
                      {allOn ? 'none' : 'all'}
                    </button>
                  )}
                </legend>

                <div className="grid gap-2 sm:grid-cols-2">
                  {permissions.map((permission) => {
                    const canGrant = grantable.has(permission.key)
                    return (
                      <label
                        key={permission.key}
                        className={`flex cursor-pointer items-start gap-2.5 text-sm ${
                          canGrant ? '' : 'cursor-not-allowed opacity-40'
                        }`}
                        title={canGrant ? permission.key : 'You do not hold this permission'}
                      >
                        <input
                          type="checkbox"
                          className="mt-0.5 size-4 accent-[#5b6241]"
                          disabled={!canGrant}
                          checked={selected.has(permission.key)}
                          onChange={() => toggle(permission.key)}
                        />
                        <span>
                          {permission.label}
                          <span className="mt-0.5 block font-mono text-[0.65rem] text-ink-soft">
                            {permission.key}
                          </span>
                        </span>
                      </label>
                    )
                  })}
                </div>
              </fieldset>
            )
          })}
        </div>
      </div>

      <div className="mt-6 flex items-center gap-3">
        <Button type="submit" size="sm" loading={saving} disabled={!name.trim()}>
          {role ? 'Save role' : 'Create role'}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <span className="text-xs text-ink-soft">{selected.size} selected</span>
      </div>
    </form>
  )
}
