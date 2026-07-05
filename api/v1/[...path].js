import { handleV1NodeRequest } from "../_lib/v1-router.mjs";

export default async function handler(req, res) {
  await handleV1NodeRequest(req, res);
}

export const config = {
  api: { bodyParser: false },
};
