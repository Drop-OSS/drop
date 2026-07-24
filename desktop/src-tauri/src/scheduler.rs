use std::time::Duration;

use async_trait::async_trait;
use log::warn;
use tokio::time;

use crate::updates::GameUpdater;

#[async_trait]
pub trait ScheduleTask {
    /// Returns how many minutes between calls
    fn timeframe(&mut self) -> usize;
    async fn call(&mut self) -> Result<(), anyhow::Error>;
}

struct TaskData {
    task: Box<dyn ScheduleTask + Send + Sync>,
    updates_since_call: usize,
}

pub async fn scheduler_task() -> ! {
    let mut interval = time::interval(Duration::from_mins(1));
    interval.tick().await;

    let mut tasks = vec![TaskData {
        task: Box::new(GameUpdater::new()),
        updates_since_call: usize::MAX - 1,
    }];

    loop {
        for task in &mut tasks {
            task.updates_since_call += 1;
            if task.task.timeframe() <= task.updates_since_call {
                let result = task.task.call().await;
                if let Err(err) = result {
                    warn!("background task returned error: {err:?}");
                }
                task.updates_since_call = 0;
            }
        }
        interval.tick().await;
    }
}
