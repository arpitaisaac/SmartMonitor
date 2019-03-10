import { Router } from "express";
import * as Model from "../Models/Users.Model";
import * as bcrypt from "bcrypt";
import * as crypto from "crypto";

export const Users = Router();
// This is the Uri
// By default when Post Request is Made
// Authenticate if this is an actual user
// If not, Perform Redirection
Users.post("/login/", async (req, res) => {
  // Find User which satisfies given requirements
  const name = String(req.body.name);
  const password = String(req.body.pass);
  const user = await Model.Users.findOne({
    where: {
      Name: name
    }
  });
  // As No Such User Found
  // Login Failed
  if (!user) return res.json({ login: false });

  // Now Compare Passwords for Matching
  // Using bcrypt for Safety
  const match = await bcrypt.compare(password, user.Password);

  if (!match) return res.json({ login: false });

  const authority: string = user.Authority;
  return res.json({ login: true });
});

// This is the Uri for Registration of a new user
Users.post("/add/", async (req, res) => {
  const name = String(req.body.name);
  const count_users = await Model.Users.count({ where: { Name: name } });

  if (count_users != 0) return res.json({ success: false, password: null });

  // Generate Random Pass Key
  const pass_key = crypto.randomBytes(10).toString("hex");
  const authority = "NORMAL";

  const new_user = await Model.Users.create({
    Name: name,
    Password: pass_key,
    Authority: authority
  });

  if (!new_user) return res.json({ success: false, password: null });

  return res.json({success: false, password: new_user.Password});
});

// This is Uri to access List of Non Admin Users
Users.get("/", async (req, res) => {
  const users = await Model.Users.findAll({
    attributes: ["id", "Name"],
    where: { Authority: "NORMAL" }
  });
  const list: any[] = [];
  users.forEach(user => {
    list.push({ id: user.id, name: user.Name });
  });
  return res.json(list);
});
Users.get("/:<int>id", async (req, res) => {
  const id = Number(req.params.id);
  const user = await Model.Users.findOne({
    where: { id: id, Authority: "NORMAL" }
  });
  if (!user)
    return res.json({
      success: false,
      data: { id: id, name: null }
    });
  return res.json({
    success: true,
    data: { id: user!.id, name: user!.Name }
  });
});
