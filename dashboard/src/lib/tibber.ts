import { errorString } from "./helpers";

export async function getPrice() {
  let query = `
  {
    viewer {
      homes {
        currentSubscription{
          priceInfo{
            current{
              total
              energy
              tax
              startsAt
            }
            today {
              total
              energy
              tax
              startsAt
            }
            tomorrow {
              total
              energy
              tax
              startsAt
            }
          }
        }
      }
    }
  }`;
  const result = await doRequest<PriceResult>(query);
  console.log(result);

  if (!result) {
    throw new Error("invalid tibber response");
  }

  return result.viewer.homes[0].currentSubscription.priceInfo;
}

export interface PriceNode {
  total: number;
  energy: number;
  tax: number;
  startsAt: string;
}

interface PriceResult {
  viewer: {
    homes: {
      currentSubscription: {
        priceInfo: {
          current: PriceNode;
          today: PriceNode[];
          tomorrow: PriceNode[];
        };
      };
    }[];
  };
}

async function doRequest<T>(query: string) {
  const init: RequestInit = {
    method: "POST",
    headers: {
      Authorization: "Bearer " + process.env.REACT_APP_TIBBER_TOKEN,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query: query,
    }),
  };
  try {
    let response = await fetch("https://api.tibber.com/v1-beta/gql", init);
    if (response.status !== 200) {
      throw new Error(`${response.status} ${response.statusText}`);
    }

    let result: GQLResponse<T> = await response.json();
    return result.data;
  } catch (err) {
    console.log(err);
    throw new Error("Query error: " + errorString(err));
  }
}

export enum Interval {
  Hourly = "HOURLY",
  Daily = "DAILY",
  Monthly = "MONTLY",
}

interface GQLResponse<T = any> {
  data: T;
}
