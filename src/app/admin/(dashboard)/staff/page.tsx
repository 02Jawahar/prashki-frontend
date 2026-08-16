'use client'

import { useCallback, useEffect, useState } from 'react'
import { Plus, Search } from 'lucide-react'
import { useAuth } from '@/hooks/use-auth'
import { rbacService, type Role, type StaffMember } from '@/services/admin-modules.service'
import { ApiRequestError } from '@/services/api-client'
import { formatDate } from '@/lib/utils'
import {
  Alert,
  Button,
  ConfirmDialog,
  EmptyState,
  Field,
  Input,
  SkeletonRows,
  StatusBadge,
} from '@/components/ui'

/**
 * Staff administration (M10, FR-24.1).
 *
 * Invitations rather than passwords: a new member is created without one and
 * sets their own through an emailed link, so nobody — including whoever
 * invited them — ever knows it, and an invitation sent to the wrong address
 * does not hand over a working account.
 *
 * The server refuses to let you suspend yourself, change your own roles, or
 * leave nobody able to manage roles and staff. Those are enforced there; this
 * screen just explains them.
 */
export default function AdminStaffPage() {
  const { can, user } = useAuth()
  const editable = can('user.manage')

  const [staff, setStaff] = useState<StaffMember[]>([])
  const [roles, setRoles] = useState<Role[]>([])
  const [q, setQ] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const [inviting, setInviting] = useState(false)
  const [editingRoles, setEditingRoles] = useState<StaffMember | null>(null)
  const [suspending, setSuspending] = useState<StaffMember | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [staffResult, roleList] = await Promise.all([
        rbacService.staff({ q: q || undefined }),
        // Needs role.manage; a user.manage-only admin still sees the list
        // through the assignments already on each row.
        rbacService.roles().catch(() => []),
      ])
      setStaff(staffResult.staff)
      setRoles(roleList)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load staff')
    } finally {
      setLoading(false)
    }
  }, [q])

  useEffect(() => {
    const timer = setTimeout(() => void load(), q ? 300 : 0)
    return () => clearTimeout(timer)
  }, [load, q])

  async function run(action: () => Promise<unknown>, message: string) {
    setBusy(true)
    setError(null)
    try {
      await action()
      setNotice(message)
      await load()
      setSuspending(null)
      setEditingRoles(null)
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'That did not work')
      setSuspending(null)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="display text-2xl">Staff</h1>
          <p className="mt-1 text-sm text-ink-soft">
            Who can sign in to the admin, and what they may do. Suspending someone ends their
            session immediately.
          </p>
        </div>
        {editable && (
          <Button size="sm" onClick={() => setInviting(true)}>
            <Plus className="size-3.5" strokeWidth={2} />
            Invite someone
          </Button>
        )}
      </header>

      {error && <Alert>{error}</Alert>}
      {notice && <Alert tone="success">{notice}</Alert>}

      {inviting && (
        <InviteForm
          roles={roles}
          onDone={async (message) => {
            setInviting(false)
            setNotice(message)
            await load()
          }}
          onCancel={() => setInviting(false)}
        />
      )}

      {editingRoles && (
        <RoleAssignment
          member={editingRoles}
          roles={roles}
          onSave={(roleIds) =>
            run(
              () => rbacService.updateStaff(editingRoles.id, { roleIds }),
              `${editingRoles.name}'s roles updated.`,
            )
          }
          onCancel={() => setEditingRoles(null)}
          busy={busy}
        />
      )}

      <div className="relative mb-5 mt-5 max-w-sm">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-soft"
          strokeWidth={1.5}
        />
        <Input
          value={q}
          onChange={(event) => setQ(event.target.value)}
          placeholder="Search by name or email"
          aria-label="Search staff"
          className="pl-9"
        />
      </div>

      <div className="border border-rule bg-white">
        {loading ? (
          <div className="p-5">
            <SkeletonRows rows={5} />
          </div>
        ) : staff.length === 0 ? (
          <div className="p-5">
            <EmptyState title="Nobody yet" body="Invite a colleague to get started." />
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-rule text-left text-xs text-ink-soft">
                <th className="p-3 font-normal">Name</th>
                <th className="p-3 font-normal">Roles</th>
                <th className="p-3 font-normal">Last signed in</th>
                <th className="p-3 font-normal">Status</th>
                <th className="p-3" />
              </tr>
            </thead>
            <tbody>
              {staff.map((member) => {
                const isSelf = member.id === user?.id
                return (
                  <tr key={member.id} className="border-b border-hairline last:border-0">
                    <td className="p-3">
                      <p>
                        {member.name}
                        {isSelf && <span className="ml-2 text-xs text-ink-soft">(you)</span>}
                      </p>
                      <p className="text-xs text-ink-soft">{member.email}</p>
                    </td>
                    <td className="p-3">
                      {member.roles.length === 0 ? (
                        <span className="text-xs text-danger">No role — cannot do anything</span>
                      ) : (
                        <span className="flex flex-wrap gap-1">
                          {member.roles.map((role) => (
                            <span key={role.id} className="badge badge-neutral">
                              {role.name}
                            </span>
                          ))}
                        </span>
                      )}
                    </td>
                    <td className="p-3 text-ink-soft">
                      {member.pendingInvite ? (
                        <span className="badge badge-warning">Invitation pending</span>
                      ) : (
                        formatDate(member.lastLoginAt!)
                      )}
                    </td>
                    <td className="p-3">
                      <StatusBadge status={member.status} />
                    </td>
                    <td className="p-3 text-right">
                      {editable && (
                        <div className="flex justify-end gap-2">
                          {member.pendingInvite && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() =>
                                void run(
                                  () => rbacService.resendInvite(member.id),
                                  `A new invitation has been sent to ${member.email}.`,
                                )
                              }
                            >
                              Resend
                            </Button>
                          )}
                          {/* Self-management is refused by the server, so the
                              controls are not offered either. */}
                          {!isSelf && (
                            <>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setEditingRoles(member)}
                              >
                                Roles
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() =>
                                  member.status === 'ACTIVE'
                                    ? setSuspending(member)
                                    : void run(
                                        () =>
                                          rbacService.updateStaff(member.id, { status: 'ACTIVE' }),
                                        `${member.name} reactivated.`,
                                      )
                                }
                              >
                                {member.status === 'ACTIVE' ? 'Suspend' : 'Reactivate'}
                              </Button>
                            </>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      <ConfirmDialog
        open={suspending !== null}
        title={`Suspend ${suspending?.name}?`}
        body="They are signed out immediately and cannot sign in again until reactivated. Their history is kept."
        confirmLabel="Suspend"
        loading={busy}
        onConfirm={() => {
          if (!suspending) return
          void run(
            () => rbacService.updateStaff(suspending.id, { status: 'SUSPENDED' }),
            `${suspending.name} suspended.`,
          )
        }}
        onCancel={() => setSuspending(null)}
      />
    </div>
  )
}

function InviteForm({
  roles,
  onDone,
  onCancel,
}: {
  roles: Role[]
  onDone: (message: string) => void | Promise<void>
  onCancel: () => void
}) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [roleIds, setRoleIds] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (saving) return

    setSaving(true)
    setError(null)

    try {
      const result = await rbacService.invite({ name, email, roleIds })
      await onDone(result.message)
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Could not send that invitation')
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} className="border border-rule bg-white p-6" noValidate>
      <h2 className="display mb-1 text-lg">Invite someone</h2>
      <p className="mb-5 text-sm text-ink-soft">
        They receive a link to set their own password. No password is created here, and the account
        cannot be used until they open it.
      </p>

      {error && <Alert>{error}</Alert>}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name" htmlFor="invite-name" required>
          <Input
            id="invite-name"
            required
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </Field>

        <Field label="Email" htmlFor="invite-email" required>
          <Input
            id="invite-email"
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </Field>
      </div>

      <fieldset className="mt-5">
        <legend className="field-label">Roles</legend>
        <p className="mb-3 text-xs text-ink-soft">
          At least one. You can only assign roles whose permissions you hold yourself.
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          {roles.map((role) => (
            <label key={role.id} className="flex cursor-pointer items-start gap-2.5 text-sm">
              <input
                type="checkbox"
                className="mt-0.5 size-4 accent-[#5b6241]"
                checked={roleIds.includes(role.id)}
                onChange={(event) =>
                  setRoleIds((current) =>
                    event.target.checked
                      ? [...current, role.id]
                      : current.filter((id) => id !== role.id),
                  )
                }
              />
              <span>
                {role.name}
                {role.description && (
                  <span className="mt-0.5 block text-xs text-ink-soft">{role.description}</span>
                )}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="mt-6 flex gap-3">
        <Button
          type="submit"
          size="sm"
          loading={saving}
          disabled={!name.trim() || !email.trim() || roleIds.length === 0}
        >
          Send invitation
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  )
}

function RoleAssignment({
  member,
  roles,
  onSave,
  onCancel,
  busy,
}: {
  member: StaffMember
  roles: Role[]
  onSave: (roleIds: string[]) => void
  onCancel: () => void
  busy: boolean
}) {
  const [roleIds, setRoleIds] = useState<string[]>(member.roles.map((role) => role.id))

  return (
    <div className="border border-rule bg-white p-6">
      <h2 className="display mb-1 text-lg">Roles for {member.name}</h2>
      <p className="mb-5 text-sm text-ink-soft">
        Effective permissions are the union of every role assigned. Changes apply on their next
        request.
      </p>

      <div className="grid gap-2 sm:grid-cols-2">
        {roles.map((role) => (
          <label key={role.id} className="flex cursor-pointer items-start gap-2.5 text-sm">
            <input
              type="checkbox"
              className="mt-0.5 size-4 accent-[#5b6241]"
              checked={roleIds.includes(role.id)}
              onChange={(event) =>
                setRoleIds((current) =>
                  event.target.checked
                    ? [...current, role.id]
                    : current.filter((id) => id !== role.id),
                )
              }
            />
            <span>
              {role.name}
              <span className="mt-0.5 block text-xs text-ink-soft">
                {role.permissions.length} permissions
              </span>
            </span>
          </label>
        ))}
      </div>

      {roleIds.length === 0 && (
        <p className="mt-4 text-xs text-danger">
          With no roles they can sign in but do nothing. Suspend them instead if that is the intent.
        </p>
      )}

      <div className="mt-6 flex gap-3">
        <Button size="sm" loading={busy} onClick={() => onSave(roleIds)}>
          Save roles
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  )
}
