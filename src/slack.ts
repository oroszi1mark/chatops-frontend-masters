import type { Handler } from "@netlify/functions";
import { parse } from "querystring";
import { blocks, modal, slackApi, verifySlackRequest } from "./util/slack";
import { saveItem } from "./util/notion";

async function handleSlashCommand(payload: SlackSlashCommandPayload) {
  switch (payload.command) {
    case "/foodfight": {
      // const joke = await fetch("https://icanhazdadjoke.com", {
      //   headers: { accept: "text/plain " },
      // });
      const response = await slackApi(
        "views.open",
        modal({
          id: "foodfight-modal",
          title: "Start a food fight",
          trigger_id: payload.trigger_id,
          blocks: [
            blocks.section({
              text: "The discourse demands food drama! *Send in your spiciest food takes so we can all argue about them and feel alive.*",
            }),
            blocks.input({
              id: "opinion",
              label: "Deposit your controversial food opinions here.",
              placeholder:
                "Example: peanut butter and mayonnaise sandwiches are delicious!",
              initial_value: payload.text ?? "",
              hint: "What do you believe about food that people find appalling? Say it with your chest!",
            }),
            blocks.select({
              id: "spice_level",
              label: "How spicy is it?",
              placeholder: "Select a spice level",
              options: [
                { label: "mild", value: "mild" },
                { label: "medium", value: "medium" },
                { label: "spicy", value: "spicy" },
                { label: "nuclear", value: "nuclear" },
              ],
            }),
          ],
        })
      );
      if (!response.ok) {
        console.log(response);
      }
      break;
    }
    default: {
      return {
        statusCode: 200,
        body: `Command ${payload.command} is not recognized`,
      };
    }
  }
  return {
    statusCode: 200,
    body: "",
  };
}

export async function handleInteractivity(payload: SlackModalPayload) {
  const callbackId = payload.callback_id ?? payload.view.callback_id;

  switch (callbackId) {
    case "foodfight-modal": {
      const data = payload.view.state.values;
      const fields = {
        opinion: data.opinion_block.opinion.value,
        spiceLevel: data.spice_level_block.spice_level.selected_option.value,
        submitter: payload.user.name,
      };
      await saveItem(fields);
      await slackApi("chat.postMessage", {
        channel: "C06BZ4D3C3D",
        text: [
          `Oh dang y'all! :eyes: <@${payload.user.id}> just started a food fight with a ${fields.spiceLevel} take:`,
          `*${fields.opinion}*`,
          "...discuss.",
        ].join("\n\n"),
      });
      break;
    }

    case "start-food-fight-nudge": {
      const channel = payload.channel?.id;
      const userId = payload.user.id;
      const threadTimestamp = payload.message.thread_ts ?? payload.message.ts;
      await slackApi("chat.postMessage", {
        channel,
        thread_ts: threadTimestamp,
        text: `Hey <@${userId}>, an opinion like this one deserves a heated public debate. Run the \`/foodfight\` slash command in a main channel to start one!`,
      });
      break;
    }

    default: {
      console.log(`No handler defined for ${callbackId}`);
      return {
        status: 400,
        body: `No handler defined for ${callbackId}`,
      };
    }
  }
  return {
    statusCode: 200,
    body: "",
  };
}

export const handler: Handler = async (event) => {
  const isValid = verifySlackRequest(event);
  if (!isValid) {
    console.error("Invalid request");
    return {
      statusCode: 400,
      body: "Invalid request",
    };
  }

  const body = parse(event.body ?? "") as SlackPayload;
  if (body.command) {
    return handleSlashCommand(body as SlackSlashCommandPayload);
  }

  if (body.payload) {
    const payload = JSON.parse(body.payload);
    return handleInteractivity(payload);
  }

  return {
    statusCode: 200,
    body: "TODO: handle Slack commands and interactivity",
  };
};
