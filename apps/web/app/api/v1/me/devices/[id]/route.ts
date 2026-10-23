import { revokeDevice } from "@moz/core";
import { z } from "zod";
import { authed, handle, json } from "@/lib/http";

export const DELETE = async (req: Request, { params }: { params: Promise<{ id: string }> }) =>
  handle(async (c) => {
    const id = z.string().uuid().parse((await params).id);
    return json(await revokeDevice(c.deps, await authed(c), id, c.meta));
  })(req);
