import { enabledSources } from './_lib/pricing.js';

// Tells the app which price sources have keys set up (never returns the keys)
export default function handler(req, res) {
  res.status(200).json({ sources: enabledSources() });
}
